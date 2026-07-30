import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pokerVotes } from "@/lib/db/schema";
import { findOrCreatePlayer } from "@/lib/poker/server";

const schema = z.object({
  playerName: z.string().min(1),
  company: z.string().default(""),
  delta: z.number().int(),
  caster: z.string().default(""),
});

// Cast a vote. Any signed-in user may vote.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const player = await findOrCreatePlayer(
    parsed.data.playerName,
    parsed.data.company,
  );

  await db.insert(pokerVotes).values({
    playerId: player.id,
    delta: parsed.data.delta,
    caster: parsed.data.caster,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
