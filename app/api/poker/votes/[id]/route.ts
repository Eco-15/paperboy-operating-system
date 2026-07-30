import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pokerVotes } from "@/lib/db/schema";

// Remove a single vote-log entry by its vote id.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await db.delete(pokerVotes).where(eq(pokerVotes.id, id));
  return NextResponse.json({ ok: true });
}
