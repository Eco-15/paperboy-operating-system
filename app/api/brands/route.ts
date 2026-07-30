import { NextResponse } from "next/server";
import { and, asc, eq, like, notLike } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { brandApps, driveFiles, docChunks } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { mergeChunks } from "@/lib/knowledge/cards";

// The knowledge brain stores one synthetic "card" per brand as a `drive_file`
// row (id `card:<brand>`) plus its embedded `doc_chunk` rows. Templates use the
// `card:_template:*` prefix and are excluded here. The full card markdown isn't
// stored as a single column, so a card's body is rebuilt from its chunks — which
// were sliced with a ~150-char overlap, merged back out below.
//
// Cards themselves only carry a title + body, so each is enriched (best-effort,
// by normalized company name) from `brand_app` — category, website, deck,
// priority, stage — which is what the library UI shows on the cards.
// (mergeChunks now lives in lib/knowledge/cards.ts — the chat's get_template tool
// needs the same re-stitching to read a style guide back out of its chunks.)

const cleanName = (s: string) => s.replace(/\s*[—-]\s*Brand Card\s*$/i, "").trim();
const norm = (s: string) => cleanName(s).toLowerCase().replace(/[^a-z0-9]/g, "");

type BrandMeta = {
  category: string | null;
  subcategory: string | null;
  website: string | null;
  deckLink: string | null;
  priority: number | null;
  stage: string | null;
  dealId: string | null;
};

// brand_app rows keyed by normalized company name, for card enrichment.
async function loadDealIndex(): Promise<Map<string, BrandMeta>> {
  const rows = await db
    .select({
      id: brandApps.id,
      company: brandApps.company,
      category: brandApps.category,
      subcategory: brandApps.subcategory,
      website: brandApps.website,
      pitchdeckLink: brandApps.pitchdeckLink,
      pitchdeckFile: brandApps.pitchdeckFile,
      priority: brandApps.priority,
      stage: brandApps.stage,
    })
    .from(brandApps);
  const map = new Map<string, BrandMeta>();
  for (const r of rows) {
    const key = norm(r.company);
    if (!key || map.has(key)) continue;
    map.set(key, {
      category: r.category,
      subcategory: r.subcategory,
      website: r.website,
      deckLink: r.pitchdeckLink ?? r.pitchdeckFile,
      priority: r.priority,
      stage: r.stage,
      dealId: r.id,
    });
  }
  return map;
}

const EMPTY_META: BrandMeta = {
  category: null,
  subcategory: null,
  website: null,
  deckLink: null,
  priority: null,
  stage: null,
  dealId: null,
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");

  // Detail: reconstruct one brand card's body from its chunks.
  if (id) {
    const [meta] = await db
      .select({ id: driveFiles.driveFileId, name: driveFiles.name, title: driveFiles.title })
      .from(driveFiles)
      .where(eq(driveFiles.driveFileId, id))
      .limit(1);
    if (!meta) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const [chunks, deals] = await Promise.all([
      db
        .select({ content: docChunks.content })
        .from(docChunks)
        .where(eq(docChunks.driveFileId, id))
        .orderBy(asc(docChunks.chunkIndex)),
      loadDealIndex(),
    ]);
    const enrich = deals.get(norm(meta.title ?? meta.name)) ?? EMPTY_META;
    return NextResponse.json({
      brand: {
        id: meta.id,
        name: meta.name,
        title: meta.title ?? meta.name,
        body: mergeChunks(chunks.map((c) => c.content)),
        ...enrich,
      },
    });
  }

  // List: every brand card (excluding templates), enriched from brand_app.
  const [rows, deals] = await Promise.all([
    db
      .select({
        id: driveFiles.driveFileId,
        name: driveFiles.name,
        title: driveFiles.title,
        updatedAt: driveFiles.lastSyncedAt,
      })
      .from(driveFiles)
      .where(
        and(
          like(driveFiles.driveFileId, "card:%"),
          notLike(driveFiles.driveFileId, "card:_template:%"),
        ),
      )
      .orderBy(asc(driveFiles.title)),
    loadDealIndex(),
  ]);

  // The brain occasionally holds two generations of the same card (re-synced
  // under a new drive_file id) — keep only the freshest per brand name.
  const byName = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const key = norm(r.title ?? r.name);
    const prev = byName.get(key);
    if (!prev || (r.updatedAt?.getTime() ?? 0) > (prev.updatedAt?.getTime() ?? 0)) {
      byName.set(key, r);
    }
  }

  const brands = [...byName.values()]
    .sort((a, b) => (a.title ?? a.name).localeCompare(b.title ?? b.name))
    .map((r) => {
      const name = r.title ?? r.name;
      const enrich = deals.get(norm(name)) ?? EMPTY_META;
      return {
        id: r.id,
        name,
        updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
        ...enrich,
      };
    });

  return NextResponse.json({ brands });
}
