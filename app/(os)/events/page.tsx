import EventsIndex from "@/components/events/EventsIndex";
import { requireRole } from "@/lib/auth/guards";

// Staff-only: every Paperboy event, with its RSVP funnel at a glance.
export default async function EventsPage() {
  await requireRole(["admin", "internal"]);
  return (
    <main className="tool-main">
      <div className="tool-head">
        <div>
          <div className="tool-title">Events</div>
          <div className="tool-sub">
            The Paperboy Invitational — RSVPs, approvals, check-in, pairings, live scoring,
            and sponsor deliverables in one place.
          </div>
        </div>
      </div>
      <EventsIndex />
    </main>
  );
}
