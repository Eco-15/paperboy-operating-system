import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import EventConsole from "@/components/events/EventConsole";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eventToRec } from "@/lib/events/map";

// The per-event console (guest list / check-in / pairings / scorecard /
// sponsors). Staff-only.
export default async function EventConsolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "internal"]);
  const { id } = await params;

  const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!row) notFound();

  return (
    <main className="tool-main">
      <Link href="/events" className="crm-back">← All events</Link>
      <EventConsole initialEvent={eventToRec(row)} />
    </main>
  );
}
