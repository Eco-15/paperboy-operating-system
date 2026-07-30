import TalentApp from "@/components/talent/TalentApp";
import { requireRole } from "@/lib/auth/guards";

// Staff-only: the talent roster — operators, marketers, and founders-in-waiting
// for portfolio placements. Mirrors the Investment CRM at /crm.
export default async function TalentPage() {
  await requireRole(["admin", "internal"]);
  return (
    <main className="tool-main">
      <div className="tool-head">
        <div>
          <div className="tool-title">Talent CRM</div>
          <div className="tool-sub">
            Your full talent roster — every operator you know plus live talent-network
            signups from the site, in one pipeline.
          </div>
        </div>
      </div>
      <TalentApp />
    </main>
  );
}
