import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { sitePages, sitePageVersions } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";
import { isSitePageSlug } from "@/lib/site-content/schema";
import { PAGE_DEFAULTS } from "@/lib/site-content/defaults";

const bodySchema = z.object({ versionId: z.string().optional() });

// Discard the draft: restore it from the live published content, or — with a
// versionId — from a History snapshot. Never touches `published`.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  if (!isSitePageSlug(slug)) {
    return NextResponse.json({ error: "Unknown page" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let content: unknown;
  if (parsed.data.versionId) {
    const [version] = await db
      .select({ content: sitePageVersions.content })
      .from(sitePageVersions)
      .where(
        and(
          eq(sitePageVersions.id, parsed.data.versionId),
          eq(sitePageVersions.pageSlug, slug),
        ),
      )
      .limit(1);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    content = version.content;
  } else {
    const [row] = await db
      .select({ published: sitePages.published })
      .from(sitePages)
      .where(eq(sitePages.slug, slug))
      .limit(1);
    content = row?.published ?? PAGE_DEFAULTS[slug];
  }

  const now = new Date();
  await db
    .insert(sitePages)
    .values({
      slug,
      draft: content,
      draftSavedAt: now,
      updatedBy: user.id,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: sitePages.slug,
      set: { draft: content, draftSavedAt: now, updatedBy: user.id, updatedAt: now },
    });

  return NextResponse.json({ draft: content, draftSavedAt: now.toISOString() });
}
