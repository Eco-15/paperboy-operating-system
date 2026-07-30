import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { eventPairings } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { pairingToRec } from "@/lib/events/map";

// Edit / remove one foursome. Deleting unassigns its members (FK set null)
// and drops its scores (FK cascade). Staff-only.
const patchSchema = z.object({
  teeTime: z.string().trim().max(50).nullable().optional(),
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
  if (!parsed.success || parsed.data.teeTime === undefined) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [row] = await db
    .update(eventPairings)
    .set({ teeTime: parsed.data.teeTime || null })
    .where(eq(eventPairings.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ pairing: pairingToRec(row) });
}

export async function DELETE(
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
  const [row] = await db
    .delete(eventPairings)
    .where(eq(eventPairings.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
