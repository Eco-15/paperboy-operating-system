import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import TalentDetail from "@/components/talent/TalentDetail";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { talents } from "@/lib/db/schema";
import { talentToRec } from "@/lib/talent/map";

// Dedicated per-person page. Staff-only.
export default async function TalentPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "internal"]);
  const { id } = await params;

  const [row] = await db.select().from(talents).where(eq(talents.id, id)).limit(1);
  if (!row) notFound();

  return (
    <main className="tool-main">
      <Link href="/talent" className="crm-back">← Back to roster</Link>
      <TalentDetail person={talentToRec(row)} />
    </main>
  );
}
