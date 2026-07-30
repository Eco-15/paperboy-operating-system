import InvestorRelations from "@/components/admin/InvestorRelations";
import { requireRole } from "@/lib/auth/guards";

// Staff console for the LP portal: manage investor logins, data-room
// documents, updates, and the curated portfolio. (Not to be confused with
// /investors — the CPG investor research database.)
export default async function AdminInvestorsPage() {
  await requireRole(["admin", "internal"]);
  return <InvestorRelations />;
}
