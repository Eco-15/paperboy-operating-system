import NewsletterApp from "@/components/newsletter/NewsletterApp";
import { requireRole } from "@/lib/auth/guards";

// Staff-only: manage the Beehiiv newsletter from inside Paperboy OS.
export default async function NewsletterPage() {
  await requireRole(["admin", "internal"]);
  return (
    <>
      <main className="tool-main">
        <div className="tool-head">
          <div>
            <div className="tool-title">Newsletter</div>
            <div className="tool-sub">Run your Beehiiv newsletter — subscribers, posts, sends</div>
          </div>
        </div>
        <NewsletterApp />
      </main>
    </>
  );
}
