import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  events,
  eventPairings,
  eventRsvps,
  eventScores,
  eventSponsors,
} from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import {
  eventToRec,
  pairingToRec,
  rsvpToRec,
  scoreToRec,
  sponsorToRec,
} from "@/lib/events/map";

// Full event console payload: the event plus its RSVPs, pairings, scores, and
// sponsors in one round trip. Staff-only.
export async function GET(
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
  const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [rsvps, pairings, scores, sponsors] = await Promise.all([
    db.select().from(eventRsvps).where(eq(eventRsvps.eventId, id)),
    db.select().from(eventPairings).where(eq(eventPairings.eventId, id)),
    db.select().from(eventScores).where(eq(eventScores.eventId, id)),
    db.select().from(eventSponsors).where(eq(eventSponsors.eventId, id)),
  ]);

  return NextResponse.json({
    event: eventToRec(row),
    rsvps: rsvps
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(rsvpToRec),
    pairings: pairings
      .sort((a, b) => a.groupNumber - b.groupNumber)
      .map(pairingToRec),
    scores: scores.map(scoreToRec),
    sponsors: sponsors
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(sponsorToRec),
  });
}
