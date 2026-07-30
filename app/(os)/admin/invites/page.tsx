import InviteManager from "@/components/admin/InviteManager";
import DriveSync from "@/components/admin/DriveSync";
import { requireRole } from "@/lib/auth/guards";

export default async function AdminInvitesPage() {
  await requireRole(["admin", "internal"]);
  return (
    <>
      <InviteManager />
      <div className="tool-main" style={{ paddingTop: 0 }}>
        <DriveSync />
      </div>
    </>
  );
}
