import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { sitePages } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";
import { PAGE_SCHEMAS, isSitePageSlug } from "@/lib/site-content/schema";
import { PAGE_DEFAULTS } from "@/lib/site-content/defaults";

// The editor's working copy for one page. Draft falls back to the static
// default (lazy seeding), published may be null (site renders the default).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  if (!isSitePageSlug(slug)) {
    return NextResponse.json({ error: "Unknown page" }, { status: 404 });
  }

  const [row] = await db
    .select()
    .from(sitePages)
    .where(eq(sitePages.slug, slug))
    .limit(1);

  return NextResponse.json({
    draft: row?.draft ?? PAGE_DEFAULTS[slug],
    published: row?.published ?? null,
    draftSavedAt: row?.draftSavedAt?.toISOString() ?? null,
    publishedAt: row?.publishedAt?.toISOString() ?? null,
  });
}

const putSchema = z.object({
  content: z.unknown(),
  // The draftSavedAt the client last loaded; a mismatch means someone else
  // saved in between (two-editor safety) and the caller must refetch.
  baseSavedAt: z.string().nullable().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  if (!isSitePageSlug(slug)) {
    return NextResponse.json({ error: "Unknown page" }, { status: 404 });
  }

  const parsedBody = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsedContent = PAGE_SCHEMAS[slug].safeParse(parsedBody.data.content);
  if (!parsedContent.success) {
    return NextResponse.json(
      { error: "Invalid content", detail: parsedContent.error.message },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ draftSavedAt: sitePages.draftSavedAt })
    .from(sitePages)
    .where(eq(sitePages.slug, slug))
    .limit(1);

  const base = parsedBody.data.baseSavedAt ?? null;
  if (existing && base !== null && existing.draftSavedAt.toISOString() !== base) {
    return NextResponse.json(
      { error: "Draft changed elsewhere", draftSavedAt: existing.draftSavedAt.toISOString() },
      { status: 409 },
    );
  }

  const now = new Date();
  const [row] = await db
    .insert(sitePages)
    .values({
      slug,
      draft: parsedContent.data,
      draftSavedAt: now,
      updatedBy: user.id,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: sitePages.slug,
      set: {
        draft: parsedContent.data,
        draftSavedAt: now,
        updatedBy: user.id,
        updatedAt: now,
      },
    })
    .returning({ draftSavedAt: sitePages.draftSavedAt });

  return NextResponse.json({ draftSavedAt: row.draftSavedAt.toISOString() });
}
