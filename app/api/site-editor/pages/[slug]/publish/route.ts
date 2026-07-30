import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sitePages, sitePageVersions } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";
import { isSitePageSlug } from "@/lib/site-content/schema";
import { PAGE_DEFAULTS } from "@/lib/site-content/defaults";

// Copy draft → published and snapshot a version. Publishing with no row yet
// publishes the static default (harmless no-op visually).
export async function POST(
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
    .select({ draft: sitePages.draft })
    .from(sitePages)
    .where(eq(sitePages.slug, slug))
    .limit(1);
  const content = row?.draft ?? PAGE_DEFAULTS[slug];

  const now = new Date();
  await db
    .insert(sitePages)
    .values({
      slug,
      draft: content,
      published: content,
      publishedAt: now,
      updatedBy: user.id,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: sitePages.slug,
      set: {
        published: content,
        publishedAt: now,
        updatedBy: user.id,
        updatedAt: now,
      },
    });

  await db.insert(sitePageVersions).values({
    pageSlug: slug,
    content,
    publishedBy: user.id,
  });

  return NextResponse.json({ publishedAt: now.toISOString() });
}
