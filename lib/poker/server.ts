import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pokerPlayers, pokerVotes } from "@/lib/db/schema";
import type { Player, VoteLogEntry } from "./types";

export interface PokerState {
  players: Player[];
  voteLog: VoteLogEntry[];
  eliminated: string[];
  status: string;
}

// Single source of truth for the live tally: votes = base import + Σ(deltas).
export async function getPokerState(): Promise<PokerState> {
  const players = await db.select().from(pokerPlayers);
  const votes = await db
    .select()
    .from(pokerVotes)
    .orderBy(asc(pokerVotes.createdAt));

  const playerById = new Map(players.map((p) => [p.id, p]));

  // Totals
  const totals = new Map<string, number>();
  for (const p of players) totals.set(p.id, p.baseVotes);
  for (const v of votes) {
    totals.set(v.playerId, (totals.get(v.playerId) ?? 0) + v.delta);
  }

  const grand = [...totals.values()].reduce((s, n) => s + n, 0);
  const playerList: Player[] = players.map((p) => {
    const votesTotal = totals.get(p.id) ?? p.baseVotes;
    return {
      name: p.name,
      company: p.company,
      votes: votesTotal,
      pct: grand > 0 ? (votesTotal / grand) * 100 : 0,
    };
  });

  // Vote log with the running newTotal at the moment of each vote (newest first).
  const running = new Map<string, number>();
  for (const p of players) running.set(p.id, p.baseVotes);
  const logAsc: VoteLogEntry[] = votes.map((v) => {
    const newTotal = (running.get(v.playerId) ?? 0) + v.delta;
    running.set(v.playerId, newTotal);
    const p = playerById.get(v.playerId);
    return {
      id: v.id,
      ts: v.createdAt.toISOString(),
      playerName: p?.name ?? "",
      company: p?.company ?? "",
      delta: v.delta,
      newTotal,
      caster: v.caster,
    };
  });

  const eliminated = players.filter((p) => p.isEliminated).map((p) => p.name);
  const real = players.filter((p) => p.name !== "HOLD").length;

  return {
    players: playerList,
    voteLog: logAsc.reverse(),
    eliminated,
    status: `${real} players · live`,
  };
}

/** Find a player by name (case-insensitive), or create it as a custom entry. */
export async function findOrCreatePlayer(name: string, company: string) {
  const existing = await db.select().from(pokerPlayers);
  const match = existing.find(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  );
  if (match) return match;
  const [created] = await db
    .insert(pokerPlayers)
    .values({ name, company, isCustom: true })
    .returning();
  return created;
}

export async function playerByName(name: string) {
  const rows = await db
    .select()
    .from(pokerPlayers)
    .where(eq(pokerPlayers.name, name))
    .limit(1);
  return rows[0];
}
