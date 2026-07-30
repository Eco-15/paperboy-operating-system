import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { investors, blogPosts, brandApps, inquiries } from "@/lib/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    [{ count: investorCount }],
    [{ count: blogCount }],
    [{ count: brandCount }],
    [{ count: openBrandCount }],
    [{ count: inquiryCount }],
    typeRows,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(investors),
    db.select({ count: sql<number>`count(*)::int` }).from(blogPosts),
    db.select({ count: sql<number>`count(*)::int` }).from(brandApps),
    // "Open" = active (unarchived) brand-app deals that aren't Closed.
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(brandApps)
      .where(
        sql`${brandApps.archived} = false and coalesce(${brandApps.stage}, '') != 'Closed'`,
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(inquiries)
      .where(sql`${inquiries.archived} = false`),
    db
      .select({ type: investors.type, count: sql<number>`count(*)::int` })
      .from(investors)
      .groupBy(investors.type),
  ]);

  const typeCounts: Record<string, number> = {};
  for (const r of typeRows) typeCounts[r.type] = r.count;

  return NextResponse.json({
    investors: investorCount,
    blogPosts: blogCount,
    brandsTracked: brandCount, // real: count of brand_app deals
    openDeals: openBrandCount + inquiryCount, // active brand-app deals + inbound leads
    typeCounts,
  });
}
