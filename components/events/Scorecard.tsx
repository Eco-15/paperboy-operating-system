"use client";

import { useMemo, useState } from "react";
import type { PairingRec, RsvpRec, ScoreRec } from "@/lib/events/types";
import { buildLeaderboard, formatToPar, HOLE_PARS } from "@/lib/events/golf";
import s from "./events.module.css";

// Scramble scoring: pick a group, thumb the steppers per hole (first tap
// seeds par), and the leaderboard below re-ranks live. All numeric entry is
// buttons, not keyboards — built for a phone in a cart.
export default function Scorecard({
  rsvps,
  pairings,
  scores,
  onSetScore,
}: {
  rsvps: RsvpRec[];
  pairings: PairingRec[];
  scores: ScoreRec[];
  onSetScore: (pairingId: string, hole: number, strokes: number | null) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(pairings[0]?.id ?? null);
  const active = pairings.find((p) => p.id === activeId) ?? pairings[0] ?? null;

  const byHole = useMemo(() => {
    const m = new Map<number, number>();
    if (active) {
      for (const sc of scores) if (sc.pairingId === active.id) m.set(sc.hole, sc.strokes);
    }
    return m;
  }, [scores, active]);

  const leaderboard = useMemo(
    () => buildLeaderboard(pairings, rsvps, scores),
    [pairings, rsvps, scores],
  );

  if (pairings.length === 0) {
    return (
      <div className={s.empty}>
        <p>No foursomes yet — build groups on the Pairings tab, then keep score here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className={s.chips}>
        {pairings.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${s.chip}${active?.id === p.id ? ` ${s.chipActive}` : ""}`}
            onClick={() => setActiveId(p.id)}
          >
            Group {p.groupNumber}
            {p.teeTime ? <span style={{ opacity: 0.65 }}>{p.teeTime}</span> : null}
          </button>
        ))}
      </div>

      {active && (
        <>
          <Nine label="Front nine" from={1} byHole={byHole} pairingId={active.id} onSetScore={onSetScore} />
          <Nine label="Back nine" from={10} byHole={byHole} pairingId={active.id} onSetScore={onSetScore} />
        </>
      )}

      <div className={s.sectionGap}>
        <div className="tool-panel-title" style={{ marginBottom: 10 }}>Leaderboard</div>
        <div className={s.lb}>
          {leaderboard.map((row, i) => {
            const started = row.thru > 0;
            return (
              <div
                key={row.pairing.id}
                className={`${s.lbRow}${i === 0 && started ? ` ${s.lbRowLead}` : ""}`}
              >
                <span className={s.lbPos}>{started ? i + 1 : "—"}</span>
                <span className={s.lbInfo}>
                  <span className={s.lbGroup}>
                    Group {row.pairing.groupNumber}
                    {row.pairing.teeTime ? ` · ${row.pairing.teeTime}` : ""}
                  </span>
                  <span className={s.lbMembers}>
                    {row.members.length
                      ? row.members.map((m) => m.name.split(" ")[0]).join(", ")
                      : "No players assigned"}
                  </span>
                </span>
                <span className={s.lbThru}>
                  {started ? `thru ${row.thru}` : "not started"}
                </span>
                <span
                  className={`${s.lbScore}${
                    started && row.toPar < 0 ? ` ${s.lbUnder}` : started && row.toPar > 0 ? ` ${s.lbOver}` : ""
                  }`}
                >
                  {started ? formatToPar(row.toPar) : "·"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Nine({
  label,
  from,
  byHole,
  pairingId,
  onSetScore,
}: {
  label: string;
  from: number;
  byHole: Map<number, number>;
  pairingId: string;
  onSetScore: (pairingId: string, hole: number, strokes: number | null) => void;
}) {
  const holes = Array.from({ length: 9 }, (_, i) => from + i);
  const entered = holes.filter((h) => byHole.has(h));
  const strokes = entered.reduce((sum, h) => sum + (byHole.get(h) ?? 0), 0);
  const par = entered.reduce((sum, h) => sum + HOLE_PARS[h - 1], 0);

  return (
    <div>
      <div className={s.nineSplit}>
        {label}
        {entered.length > 0 ? ` — ${strokes} strokes (${formatToPar(strokes - par)})` : ""}
      </div>
      <div className={s.holeGrid}>
        {holes.map((hole) => {
          const parFor = HOLE_PARS[hole - 1];
          const val = byHole.get(hole);
          return (
            <div key={hole} className={s.hole}>
              <div className={s.holeLabel}>
                Hole {hole} · Par {parFor}
              </div>
              <div className={s.holeRow}>
                <button
                  type="button"
                  className={s.stepBtn}
                  aria-label={`Hole ${hole}: minus`}
                  disabled={val === undefined}
                  onClick={() =>
                    onSetScore(pairingId, hole, val !== undefined && val > 1 ? val - 1 : null)
                  }
                >
                  −
                </button>
                <span
                  className={`${s.holeScore}${
                    val === undefined
                      ? ` ${s.holeScoreEmpty}`
                      : val < parFor
                        ? ` ${s.holeUnder}`
                        : val > parFor
                          ? ` ${s.holeOver}`
                          : ""
                  }`}
                >
                  {val ?? "—"}
                </span>
                <button
                  type="button"
                  className={s.stepBtn}
                  aria-label={`Hole ${hole}: plus`}
                  onClick={() => onSetScore(pairingId, hole, val === undefined ? parFor : val + 1)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
