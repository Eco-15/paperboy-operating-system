import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sitePageVersions } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";
import { isSitePageSlug } from "@/lib/site-content/schema";

// Publish history for one page — metadata only, restore goes through /revert.
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

  const rows = await db
    .select({
      id: sitePageVersions.id,
      publishedBy: sitePageVersions.publishedBy,
      createdAt: sitePageVersions.createdAt,
    })
    .from(sitePageVersions)
    .where(eq(sitePageVersions.pageSlug, slug))
    .orderBy(desc(sitePageVersions.createdAt))
    .limit(30);

  return NextResponse.json({ versions: rows });
}
