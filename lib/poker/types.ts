export interface CsvRow {
  name: string;
  company: string;
  votes: number;
}

export interface CustomPlayer {
  name: string;
  company: string;
}

/** A player as displayed: base/override votes resolved + percentage. */
export interface Player {
  name: string;
  company: string;
  votes: number;
  pct: number;
}

export interface VoteLogEntry {
  id: string;
  ts: string; // ISO timestamp
  playerName: string;
  company: string;
  delta: number;
  newTotal: number;
  caster: string;
}

export type SortKey = "name" | "votes" | "pct";

/** localStorage keys — preserved exactly from dashboard.html so existing data survives. */
export const LS = {
  customPlayers: "customPlayers",
  eliminated: "eliminatedPlayers",
  overrides: "voteOverrides",
  voteLog: "voteLog",
} as const;
