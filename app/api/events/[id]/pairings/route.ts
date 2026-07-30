import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { events, eventPairings } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { pairingToRec } from "@/lib/events/map";

// Create the next foursome for an event (group_number auto-increments).
// Staff-only.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, id))
    .limit(1);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${eventPairings.groupNumber}), 0)` })
    .from(eventPairings)
    .where(eq(eventPairings.eventId, id));

  const [row] = await db
    .insert(eventPairings)
    .values({ eventId: id, groupNumber: Number(max) + 1 })
    .returning();

  return NextResponse.json({ pairing: pairingToRec(row) }, { status: 201 });
}
