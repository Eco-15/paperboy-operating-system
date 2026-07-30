"use client";

import { useEffect, useState } from "react";
import type { Player, VoteLogEntry } from "@/lib/poker/types";

function fmtTime(ts: string): string {
  const d = new Date(ts);
  return (
    d.toLocaleDateString() +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

export default function VoteModal({
  player,
  history,
  isEliminated,
  onSubmit,
  onRemove,
  onToggleEliminate,
  onClose,
}: {
  player: Player;
  history: VoteLogEntry[];
  isEliminated: boolean;
  onSubmit: (delta: number, caster: string) => void;
  onRemove: (id: string) => void;
  onToggleEliminate: () => void;
  onClose: () => void;
}) {
  const [votes, setVotes] = useState("");
  const [caster, setCaster] = useState("");

  function submit() {
    const delta = parseInt(votes, 10);
    if (isNaN(delta) || delta <= 0) return;
    if (!caster.trim()) return;
    onSubmit(delta, caster.trim());
    setVotes("");
    setCaster("");
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") submit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votes, caster]);

  return (
    <div className="tool-modal-backdrop" onClick={onClose}>
      <div className="tool-modal" onClick={(e) => e.stopPropagation()}>
        <button className="tool-modal-close" type="button" onClick={onClose} aria-label="Close">
          &#x2715;
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h2>{player.name}</h2>
            <div className="tool-modal-meta">{player.company}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="poker-stat-label">Total Votes</div>
            <div className="poker-stat-value">{player.votes}</div>
          </div>
        </div>

        <div className="tool-panel-title" style={{ marginTop: 16 }}>
          Vote History
        </div>
        <div>
          {history.length === 0 ? (
            <div className="tool-sub-line">No votes yet.</div>
          ) : (
            <ul className="poker-log">
              {history.map((e) => (
                <li className="poker-log-item" key={e.id}>
                  <div>
                    <div>{e.caster}</div>
                    <div className="poker-log-meta">{fmtTime(e.ts)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="poker-votes">+{e.delta}</span>
                    <button
                      className="poker-mini-btn"
                      type="button"
                      onClick={() => onRemove(e.id)}
                    >
                      remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="tool-field" style={{ marginTop: 16 }}>
          <label>Votes to Add</label>
          <input
            className="tool-input"
            type="number"
            min={1}
            placeholder="0"
            value={votes}
            autoFocus
            onChange={(e) => setVotes(e.target.value)}
          />
        </div>
        <div className="tool-field">
          <label>Voted by</label>
          <input
            className="tool-input"
            type="text"
            placeholder="Name of voter"
            value={caster}
            onChange={(e) => setCaster(e.target.value)}
          />
        </div>

        <div className="tool-modal-actions">
          <button className="tool-btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="tool-btn"
            type="button"
            style={{ marginRight: "auto" }}
            onClick={onToggleEliminate}
          >
            {isEliminated ? "Reinstate" : "Eliminate"}
          </button>
          <button className="tool-btn tool-btn--solid" type="button" onClick={submit}>
            Log Vote
          </button>
        </div>
      </div>
    </div>
  );
}
