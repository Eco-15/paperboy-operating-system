import { z } from "zod";
import { db } from "@/lib/db";
import { pokerVotes } from "@/lib/db/schema";
import { findOrCreatePlayer } from "@/lib/poker/server";
import type { ActionHandler } from "../../types";

const schema = z.object({
  playerName: z.string().min(1),
  company: z.string().default(""),
  delta: z.number().int(),
  caster: z.string().default(""),
});

export const castVote: ActionHandler = async (params) => {
  const parsed = schema.safeParse(params);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const d = parsed.data;

  const player = await findOrCreatePlayer(d.playerName, d.company);

  await db.insert(pokerVotes).values({
    playerId: player.id,
    delta: d.delta,
    caster: d.caster,
  });

  return {
    ok: true,
    data: { playerName: player.name },
    edits: [{ objectType: "PokerPlayer", objectId: player.id, operation: "update" }],
  };
};
