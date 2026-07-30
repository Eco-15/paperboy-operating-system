import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pokerPlayers } from "@/lib/db/schema";
import { playerByName } from "@/lib/poker/server";
import type { ActionHandler } from "../../types";

const schema = z.object({ name: z.string().min(1) });

export const eliminatePlayer: ActionHandler = async (params) => {
  const parsed = schema.safeParse(params);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const player = await playerByName(parsed.data.name);
  if (!player) return { ok: false, error: "Player not found" };

  await db
    .update(pokerPlayers)
    .set({ isEliminated: !player.isEliminated })
    .where(eq(pokerPlayers.id, player.id));

  return {
    ok: true,
    data: { name: player.name, eliminated: !player.isEliminated },
    edits: [{ objectType: "PokerPlayer", objectId: player.id, operation: "update" }],
  };
};
