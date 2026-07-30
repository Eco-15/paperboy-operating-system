import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { eventPairings, eventScores } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { scoreToRec } from "@/lib/events/map";

// Upsert one hole's scramble score for a foursome; null strokes clears the
// hole. Keyed on the (pairing_id, hole) unique index. Staff-only.
const putSchema = z.object({
  pairingId: z.string().min(1),
  hole: z.coerce.number().int().min(1).max(18),
  strokes: z.coerce.number().int().min(1).max(20).nullable(),
});

export async function PUT(
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
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  const [pairing] = await db
    .select({ id: eventPairings.id })
    .from(eventPairings)
    .where(and(eq(eventPairings.id, d.pairingId), eq(eventPairings.eventId, id)))
    .limit(1);
  if (!pairing) {
    return NextResponse.json({ error: "Unknown pairing" }, { status: 400 });
  }

  if (d.strokes === null) {
    await db
      .delete(eventScores)
      .where(
        and(eq(eventScores.pairingId, d.pairingId), eq(eventScores.hole, d.hole)),
      );
    return NextResponse.json({ ok: true });
  }

  const [row] = await db
    .insert(eventScores)
    .values({ eventId: id, pairingId: d.pairingId, hole: d.hole, strokes: d.strokes })
    .onConflictDoUpdate({
      target: [eventScores.pairingId, eventScores.hole],
      set: { strokes: d.strokes },
    })
    .returning();

  return NextResponse.json({ score: scoreToRec(row) });
}
