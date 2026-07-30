import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pokerPlayers } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { playerByName } from "@/lib/poker/server";

const schema = z.object({ name: z.string().min(1) });

// Toggle a player's eliminated status. Staff only.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const player = await playerByName(parsed.data.name);
  if (!player) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(pokerPlayers)
    .set({ isEliminated: !player.isEliminated })
    .where(eq(pokerPlayers.id, player.id));

  return NextResponse.json({ ok: true });
}
