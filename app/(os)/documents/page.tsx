import DocumentLibrary from "@/components/documents/DocumentLibrary";
import { requireRole } from "@/lib/auth/guards";

// Documents built in the chat panel — memos, decks, models, one-pagers. They outlive
// the conversation that produced them, which is why they live in their own table
// rather than inside chat_message.parts.
export default async function DocumentsPage() {
  await requireRole(["admin", "internal"]);
  return (
    <main className="tool-main">
      <div className="tool-head">
        <div>
          <div className="tool-title">Documents</div>
          <div className="tool-sub">
            Everything you and Paperboy have written together — with the full edit history.
          </div>
        </div>
      </div>
      <DocumentLibrary />
    </main>
  );
}
