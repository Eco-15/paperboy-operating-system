import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { brandApps, inquiries } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { isInboundResponse, MANUAL_SOURCE } from "@/lib/crm/inbound";
import { brandAppToDeal, inquiryToDeal } from "@/lib/crm/map";
import { getCrmSeenAt } from "@/lib/crm/seen";
import { ASSIGNABLE_STAGES, FUNDS } from "@/lib/crm/stages";

// The Investment CRM is one pipeline over two sources, all in Cloud SQL:
//  • brand_app — the DEALS master (Squarespace applications + companies added in-app)
//  • inquiry   — live website-form leads (/for-founders, /for-investors, /contact)
// Both are normalized to a single Deal shape (lib/crm/map) and returned
// newest-first, so a fresh form submission surfaces at the top with origin "form".
//
// brand_app mirrors the szn4 Google Sheet, which is the system of record: Squarespace
// form blocks write into it and we pull on read (see lib/crm/sheet-sync).

function ts(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

// A backlog this long is a sheet re-import, not a morning's mail — cap it so the
// payload and the tray stay sane. "Mark all caught up" clears the rest.
const NEW_IDS_CAP = 200;

// Pulling the sheet on every request would mean a Drive round-trip per page load,
// poll and mobile refetch — hundreds of calls an hour against quota, each adding 1-2s
// to the response. This throttles it so only the first load in the window pays.
// Per-instance state is fine: the upsert is idempotent, so a second Cloud Run
// instance syncing on its own schedule is harmless.
const SYNC_TTL_MS = 60_000;
let lastSyncAt = 0;
let inFlight: Promise<unknown> | null = null;

async function syncSheetIfStale(): Promise<void> {
  if (Date.now() - lastSyncAt < SYNC_TTL_MS) return;

  // Collapse concurrent requests onto one sync. `inFlight` MUST be assigned with no
  // await between the check above and the assignment below — the dynamic import is
  // deliberately inside the promise, because awaiting it out here would yield and let
  // a second request past the guard, producing two Drive fetches and two interleaved
  // upsert passes over the same rows (which can double-insert).
  if (!inFlight) {
    inFlight = (async () => {
      const { syncBrandAppsFromSheet } = await import("@/lib/crm/sheet-sync");
      return syncBrandAppsFromSheet();
    })()
      .then((r) => {
        if (r.inserted || r.updated) {
          console.log(
            `[crm] sheet sync: +${r.inserted} new, ${r.updated} updated, ` +
              `${r.unchanged} unchanged, ${r.matchedByHost} matched by domain`,
          );
        }
      })
      .catch((e) => {
        // Fail OPEN. A Drive outage must not blank the pipeline — stale deals beat no
        // deals. The tradeoff is that a misconfigured identity degrades SILENTLY (the
        // CRM just stops tracking the sheet), so this message has to be findable and
        // name the likely cause: until now Drive was only ever called from the
        // drive-ingest Cloud Run *Job*, which runs under its own service account.
        console.error(
          "[crm] sheet sync failed — serving from Postgres. If this is a 403/401, " +
            "check the paperboy-os service account has drive.readonly AND is a Viewer " +
            "on the shared drive holding the szn4 sheet (docs/SETUP_GOOGLE_CLOUD.md " +
            "Step 5). Error:",
          e,
        );
      })
      .finally(() => {
        // Stamped on both paths so a hard failure backs off for a full window
        // instead of being retried on every single request.
        lastSyncAt = Date.now();
        inFlight = null;
      });
  }
  await inFlight;
}

export async function GET(req: Request) {
  const session = await auth();
  // user.id is required here (not just user) — the "new since" watermark is
  // keyed by it.
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ?view=archive returns only the parked deals, ?view=all returns the whole
  // book (active + parked — the CRM's source-of-truth view); the default
  // pipeline view returns only active (unarchived) ones.
  const viewParam = new URL(req.url).searchParams.get("view");
  const view =
    viewParam === "archive" ? "archive" : viewParam === "all" ? "all" : "pipeline";

  // ?lite=1 is the mobile shell's frequent list refetch — it doesn't need to trigger
  // a Drive pull, and skipping it keeps the phone app snappy.
  const lite = new URL(req.url).searchParams.get("lite") === "1";
  if (!lite) await syncSheetIfStale();

  const [apps, forms] = await Promise.all([
    db.select().from(brandApps),
    db.select().from(inquiries),
  ]);

  const all = [...forms.map(inquiryToDeal), ...apps.map(brandAppToDeal)].sort(
    (a, b) => ts(b.date) - ts(a.date),
  );
  const scoped =
    view === "all" ? all : all.filter((d) => d.archived === (view === "archive"));

  // ?lite=1 also strips the long-text fields (memo, message) — the mobile shell
  // lists hundreds of deals and re-fetches one in full when a card opens.
  const deals = lite
    ? scoped.map(({ message, onePager, ...rest }) => ({
        ...rest,
        message: null,
        onePager: null,
      }))
    : scoped;

  // "New" = genuinely untriaged inbound leads, not the whole history.
  const newCount = deals.filter(
    (d) => d.origin === "form" && (!d.stage || d.stage === "New"),
  ).length;
  const archivedCount = all.length - all.filter((d) => !d.archived).length;

  // ── "New responses since you last looked" ────────────────────────────────
  // Per-user watermark. Anything inbound that landed after it is new to THIS
  // person, whoever else has already seen it. The mark only moves when the
  // client acknowledges it (POST /api/crm/seen) — deliberately not here, or the
  // phone app's pull-to-refresh would silently burn the list before it's read.
  const seenAt = await getCrmSeenAt(session.user.id);
  const newIds = seenAt
    ? all
        .filter(
          (d) =>
            !d.archived &&
            isInboundResponse(d) &&
            d.arrivedAt !== null &&
            new Date(d.arrivedAt).getTime() > seenAt.getTime(),
        )
        .sort((a, b) => ts(b.arrivedAt) - ts(a.arrivedAt))
        .slice(0, NEW_IDS_CAP)
        .map((d) => d.id)
    : [];

  return NextResponse.json({
    deals,
    newCount,
    archivedCount,
    newSince: seenAt ? seenAt.toISOString() : null,
    newIds,
  });
}

// Add a company to the deal pipeline. Staff-only. Lands in brand_app.
const createSchema = z.object({
  company: z.string().min(1).max(200),
  category: z.string().max(120).optional(),
  subcategory: z.string().max(120).optional(),
  stage: z.enum(ASSIGNABLE_STAGES as [string, ...string[]]).optional(),
  priority: z.coerce.number().int().min(1).max(6).optional(),
  fund: z.enum(FUNDS as [string, ...string[]]).optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().max(200).optional().or(z.literal("")),
  website: z.string().max(500).optional(),
  message: z.string().max(5000).optional(),
  pitchdeckLink: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  const [row] = await db
    .insert(brandApps)
    .values({
      company: d.company.trim(),
      category: d.category?.trim() || null,
      subcategory: d.subcategory?.trim() || null,
      source: MANUAL_SOURCE,
      priority: d.priority ?? null,
      stage: d.stage || "New",
      fund: d.fund ?? null,
      contactName: d.contactName?.trim() || null,
      contactEmail: d.contactEmail?.trim() || null,
      message: d.message?.trim() || null,
      website: d.website?.trim() || null,
      pitchdeckLink: d.pitchdeckLink?.trim() || null,
      dateSubmitted: new Date().toISOString(),
    })
    .returning();

  return NextResponse.json({ deal: brandAppToDeal(row) }, { status: 201 });
}
