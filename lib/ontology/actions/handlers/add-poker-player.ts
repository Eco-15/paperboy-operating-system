import { z } from "zod";
import { db } from "@/lib/db";
import { pokerPlayers } from "@/lib/db/schema";
import type { ActionHandler } from "../../types";

const schema = z.object({
  name: z.string().min(1),
  company: z.string().default(""),
});

export const addPokerPlayer: ActionHandler = async (params) => {
  const parsed = schema.safeParse(params);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const d = parsed.data;

  const existing = await db.select().from(pokerPlayers);
  if (existing.some((p) => p.name.toLowerCase() === d.name.toLowerCase())) {
    return { ok: false, error: "Player already exists" };
  }

  const [row] = await db
    .insert(pokerPlayers)
    .values({ name: d.name, company: d.company, isCustom: true })
    .returning();

  return {
    ok: true,
    data: { name: row.name },
    edits: [{ objectType: "PokerPlayer", objectId: row.id, operation: "create" }],
  };
};
