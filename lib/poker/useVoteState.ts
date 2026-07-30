"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Player, VoteLogEntry } from "./types";

interface PokerState {
  players: Player[];
  voteLog: VoteLogEntry[];
  eliminated: string[];
  status: string;
}

// Backed by the database via /api/poker/*. Polls every 10s for a live tally
// (replacing the old CSV + localStorage). Public API is unchanged so the poker
// components don't need edits.
export function useVoteState() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [voteLog, setVoteLog] = useState<VoteLogEntry[]>([]);
  const [eliminatedArr, setEliminatedArr] = useState<string[]>([]);
  const [status, setStatus] = useState("Loading…");

  // Latest players for the synchronous duplicate check in addPlayer().
  const playersRef = useRef<Player[]>([]);
  playersRef.current = players;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/poker/state", { cache: "no-store" });
      if (!res.ok) throw new Error(res.statusText);
      const data = (await res.json()) as PokerState;
      setPlayers(data.players);
      setVoteLog(data.voteLog);
      setEliminatedArr(data.eliminated);
      setStatus(data.status);
    } catch {
      setStatus("Could not load tally.");
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, [refresh]);

  const eliminated = useMemo(() => new Set(eliminatedArr), [eliminatedArr]);

  const post = useCallback(
    async (url: string, body: unknown) => {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await refresh();
    },
    [refresh],
  );

  /** Synchronous duplicate check (returns false if the name exists), then POST. */
  const addPlayer = useCallback(
    (name: string, company: string): boolean => {
      const exists = playersRef.current.some(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
      );
      if (exists) return false;
      void post("/api/poker/players", { name, company });
      return true;
    },
    [post],
  );

  const submitVote = useCallback(
    (playerName: string, company: string, delta: number, caster: string) => {
      void post("/api/poker/votes", { playerName, company, delta, caster });
    },
    [post],
  );

  const removeLogEntry = useCallback(
    (id: string) => {
      void fetch(`/api/poker/votes/${id}`, { method: "DELETE" }).then(() =>
        refresh(),
      );
    },
    [refresh],
  );

  const toggleEliminate = useCallback(
    (name: string) => {
      void post("/api/poker/eliminate", { name });
    },
    [post],
  );

  const seedTestData = useCallback(() => {
    void post("/api/poker/test", { action: "seed" });
  }, [post]);

  const clearTestData = useCallback(() => {
    void post("/api/poker/test", { action: "clear" });
  }, [post]);

  return {
    players,
    voteLog,
    eliminated,
    status,
    addPlayer,
    submitVote,
    removeLogEntry,
    toggleEliminate,
    seedTestData,
    clearTestData,
  };
}
