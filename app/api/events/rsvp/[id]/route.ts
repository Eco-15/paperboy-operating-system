import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { eventPairings, eventRsvps } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { rsvpToRec } from "@/lib/events/map";
import { RSVP_STATUSES } from "@/lib/events/types";

// Update one RSVP: approval status and/or foursome assignment. Staff-only.
const patchSchema = z.object({
  status: z.enum(RSVP_STATUSES as [string, ...string[]]).optional(),
  pairingId: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
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
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  const [rsvp] = await db
    .select()
    .from(eventRsvps)
    .where(eq(eventRsvps.id, id))
    .limit(1);
  if (!rsvp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const set: Partial<typeof eventRsvps.$inferInsert> = {};
  if (d.status !== undefined) {
    set.status = d.status;
    // Only approved players belong in a foursome.
    if (d.status !== "approved_player") set.pairingId = null;
  }
  if (d.pairingId !== undefined) {
    if (d.pairingId === null) {
      set.pairingId = null;
    } else {
      const [pairing] = await db
        .select({ id: eventPairings.id })
        .from(eventPairings)
        .where(
          and(
            eq(eventPairings.id, d.pairingId),
            eq(eventPairings.eventId, rsvp.eventId),
          ),
        )
        .limit(1);
      if (!pairing) {
        return NextResponse.json({ error: "Unknown pairing" }, { status: 400 });
      }
      set.pairingId = d.pairingId;
    }
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const [row] = await db
    .update(eventRsvps)
    .set(set)
    .where(eq(eventRsvps.id, id))
    .returning();
  return NextResponse.json({ rsvp: rsvpToRec(row) });
}
