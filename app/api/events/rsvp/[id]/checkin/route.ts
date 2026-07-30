import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { eventRsvps } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { rsvpToRec } from "@/lib/events/map";

// Toggle a guest's check-in: not checked in → stamp now; already in → clear
// (the undo). One tap each way at the door. Staff-only.
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
  const [rsvp] = await db
    .select()
    .from(eventRsvps)
    .where(eq(eventRsvps.id, id))
    .limit(1);
  if (!rsvp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [row] = await db
    .update(eventRsvps)
    .set({ checkedInAt: rsvp.checkedInAt ? null : new Date() })
    .where(eq(eventRsvps.id, id))
    .returning();
  return NextResponse.json({ rsvp: rsvpToRec(row) });
}
