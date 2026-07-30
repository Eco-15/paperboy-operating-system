import Link from "next/link";
import TalentArchive from "@/components/talent/TalentArchive";
import { requireRole } from "@/lib/auth/guards";

// Staff-only: parked people — passed, on hold, or benched — kept out of the
// live roster but searchable. Restore one to put them back on the board.
export default async function TalentArchivePage() {
  await requireRole(["admin", "internal"]);
  return (
    <main className="tool-main">
      <Link href="/talent" className="crm-back">← Back to roster</Link>
      <div className="tool-head">
        <div>
          <div className="tool-title">Talent Archive</div>
          <div className="tool-sub">
            Everyone who&apos;s parked — passed, on hold, or on the bench. Restore a person
            to put them back on the board.
          </div>
        </div>
      </div>
      <TalentArchive />
    </main>
  );
}
