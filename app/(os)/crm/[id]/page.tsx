import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import CrmDealDetail from "@/components/crm/CrmDealDetail";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { brandApps, inquiries } from "@/lib/db/schema";
import { brandAppToDeal, inquiryToDeal } from "@/lib/crm/map";
import { getBrandCard } from "@/lib/knowledge/cards";
import type { Deal } from "@/lib/crm/types";

// Dedicated per-deal page. The id resolves against brand_app first, then
// inquiry (uuids are unique across both), so every deal — including ones just
// added in-app — gets its own URL automatically. Staff-only.
export default async function CrmDealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "internal"]);
  const { id } = await params;

  let deal: Deal | null = null;
  const [app] = await db.select().from(brandApps).where(eq(brandApps.id, id)).limit(1);
  if (app) {
    deal = brandAppToDeal(app);
  } else {
    const [form] = await db.select().from(inquiries).where(eq(inquiries.id, id)).limit(1);
    if (form) deal = inquiryToDeal(form);
  }
  if (!deal) notFound();

  // The Brand Library, folded in: each deal carries its brand file (the
  // knowledge card the old /brands tab showed) right on the deal page.
  const brandCard = await getBrandCard(deal.company).catch(() => null);

  return (
    <>
      <main className="tool-main">
        <Link href="/crm" className="crm-back">← Back to pipeline</Link>
        <CrmDealDetail deal={deal} brandCard={brandCard} />
      </main>
    </>
  );
}
