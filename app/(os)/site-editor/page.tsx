import { requireRole } from "@/lib/auth/guards";
import SiteEditorApp from "@/components/site-editor/SiteEditorApp";

export default async function SiteEditorPage() {
  await requireRole(["admin", "internal"]);

  return (
    <main className="tool-main">
      <div className="tool-head">
        <div>
          <div className="tool-title">Site Editor</div>
          <div className="tool-sub">
            The Press Room — edit the public paper, then publish
          </div>
        </div>
      </div>
      <SiteEditorApp />
    </main>
  );
}
