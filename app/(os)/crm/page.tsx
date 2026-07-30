import CrmApp from "@/components/crm/CrmApp";
import { requireRole } from "@/lib/auth/guards";

// Staff-only: inbound deal / investor pipeline.
export default async function CrmPage() {
  await requireRole(["admin", "internal"]);
  return (
    <>
      <main className="tool-main">
        <div className="tool-head">
          <div>
            <div className="tool-title">Investment CRM</div>
            <div className="tool-sub">
              Your full deal pipeline — every brand application plus live inbound from the website,
              in one place.
            </div>
          </div>
        </div>
        <CrmApp />
      </main>
    </>
  );
}
