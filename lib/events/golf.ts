import type { PairingRec, RsvpRec, ScoreRec } from "./types";

// Scramble scoring against a standard par-72 card (36 out / 36 in). The venue
// is TBA, so this is the neutral layout scores are read against until a real
// course card replaces it.
export const HOLE_PARS = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4];
export const COURSE_PAR = HOLE_PARS.reduce((a, b) => a + b, 0);

export interface LeaderboardRow {
  pairing: PairingRec;
  members: RsvpRec[];
  thru: number; // holes with a score entered
  strokes: number; // total strokes over those holes
  toPar: number; // strokes − par for the holes played
}

export function formatToPar(toPar: number): string {
  if (toPar === 0) return "E";
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}

// Rank groups by score relative to par, deeper into the round first on ties.
export function buildLeaderboard(
  pairings: PairingRec[],
  rsvps: RsvpRec[],
  scores: ScoreRec[],
): LeaderboardRow[] {
  const rows = pairings.map((pairing) => {
    const held = scores.filter((s) => s.pairingId === pairing.id);
    const strokes = held.reduce((sum, s) => sum + s.strokes, 0);
    const par = held.reduce((sum, s) => sum + (HOLE_PARS[s.hole - 1] ?? 4), 0);
    return {
      pairing,
      members: rsvps.filter((r) => r.pairingId === pairing.id),
      thru: held.length,
      strokes,
      toPar: strokes - par,
    };
  });
  return rows.sort((a, b) => {
    if (a.thru === 0 && b.thru === 0) return a.pairing.groupNumber - b.pairing.groupNumber;
    if (a.thru === 0) return 1;
    if (b.thru === 0) return -1;
    if (a.toPar !== b.toPar) return a.toPar - b.toPar;
    if (a.thru !== b.thru) return b.thru - a.thru;
    return a.pairing.groupNumber - b.pairing.groupNumber;
  });
}
