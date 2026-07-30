import Link from "next/link";
import CrmArchive from "@/components/crm/CrmArchive";
import { requireRole } from "@/lib/auth/guards";

// Staff-only: the parked deal history — Passed / Hold / Watch and the bulk of
// the historical CSV import — kept out of the live pipeline but searchable.
export default async function CrmArchivePage() {
  await requireRole(["admin", "internal"]);
  return (
    <main className="tool-main">
      <Link href="/crm" className="crm-back">← Back to pipeline</Link>
      <div className="tool-head">
        <div>
          <div className="tool-title">Deal Archive</div>
          <div className="tool-sub">
            Every deal that&apos;s parked — passed, on hold, watching, or historical imports.
            Restore one to put it back on the board.
          </div>
        </div>
      </div>
      <CrmArchive />
    </main>
  );
}
