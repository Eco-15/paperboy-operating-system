"use client";

import { useMemo, useState } from "react";
import type { PairingRec, RsvpRec } from "@/lib/events/types";
import s from "./events.module.css";

// Build foursomes by tap: pick a player from the unassigned pool, then tap the
// group to drop them into. Works one-handed on a phone; no drag required.
export default function Pairings({
  rsvps,
  pairings,
  onAssign,
  onAddPairing,
  onSetTeeTime,
  onRemovePairing,
}: {
  rsvps: RsvpRec[];
  pairings: PairingRec[];
  onAssign: (rsvpId: string, pairingId: string | null) => void;
  onAddPairing: () => void;
  onSetTeeTime: (pairingId: string, teeTime: string) => void;
  onRemovePairing: (pairingId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const players = useMemo(
    () => rsvps.filter((r) => r.status === "approved_player"),
    [rsvps],
  );
  const pool = useMemo(
    () => players.filter((r) => !r.pairingId).sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  );
  const selectedPlayer = pool.find((r) => r.id === selected) ?? null;

  if (players.length === 0) {
    return (
      <div className={s.empty}>
        <p>
          No approved players yet — use “Approve as Player” on the Guest List tab, then build
          foursomes here.
        </p>
      </div>
    );
  }

  function assign(pairingId: string) {
    if (!selectedPlayer) return;
    onAssign(selectedPlayer.id, pairingId);
    setSelected(null);
  }

  return (
    <div>
      <div className="tool-toolbar" style={{ flexWrap: "wrap", margin: "0 0 1rem" }}>
        <span className="tool-count">
          {players.length} players · {pool.length} unassigned · {pairings.length}{" "}
          {pairings.length === 1 ? "group" : "groups"}
        </span>
        <div style={{ marginLeft: "auto" }}>
          <button className="tool-btn tool-btn--solid" type="button" onClick={onAddPairing}>
            + New group
          </button>
        </div>
      </div>

      <div className={s.pairLayout}>
        <div className={s.pool}>
          <div className={s.poolTitle}>
            Unassigned players ({pool.length})
            {selectedPlayer ? " — now tap a group" : ""}
          </div>
          {pool.length === 0 ? (
            <p style={{ opacity: 0.6, fontSize: "0.85rem", margin: 0 }}>
              Everyone&apos;s in a group.
            </p>
          ) : (
            pool.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`${s.poolPlayer}${selected === r.id ? ` ${s.poolPlayerSel}` : ""}`}
                onClick={() => setSelected(selected === r.id ? null : r.id)}
              >
                {r.name}
                {r.company ? (
                  <span style={{ opacity: 0.55, fontSize: "0.78rem" }}> · {r.company}</span>
                ) : null}
              </button>
            ))
          )}
        </div>

        <div>
          {pairings.length === 0 ? (
            <div className={s.empty}>
              <p>No groups yet.</p>
              <button className="tool-btn tool-btn--solid" type="button" onClick={onAddPairing}>
                + New group
              </button>
            </div>
          ) : (
            <div className={s.groupGrid}>
              {pairings.map((p) => {
                const members = players.filter((r) => r.pairingId === p.id);
                return (
                  <div key={p.id} className={s.groupCard}>
                    <div className={s.groupHead}>
                      <span className={s.groupName}>Group {p.groupNumber}</span>
                      <input
                        className={s.teeInput}
                        type="text"
                        placeholder="Tee time"
                        defaultValue={p.teeTime ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== (p.teeTime ?? "")) onSetTeeTime(p.id, v);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                      />
                      <button
                        type="button"
                        className={s.memberX}
                        title="Delete group (players return to the pool)"
                        onClick={() => onRemovePairing(p.id)}
                      >
                        ✕
                      </button>
                    </div>

                    {members.length === 0 ? (
                      <p style={{ opacity: 0.5, fontSize: "0.82rem", margin: "4px 0" }}>Empty</p>
                    ) : (
                      members.map((m) => (
                        <div key={m.id} className={s.member}>
                          {m.name}
                          {m.company ? (
                            <span style={{ opacity: 0.5, fontSize: "0.76rem" }}>{m.company}</span>
                          ) : null}
                          <button
                            type="button"
                            className={s.memberX}
                            title="Remove from group"
                            onClick={() => onAssign(m.id, null)}
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}

                    <button
                      type="button"
                      className={`${s.addHere}${selectedPlayer ? ` ${s.addHereReady}` : ""}`}
                      onClick={() => assign(p.id)}
                      disabled={!selectedPlayer}
                    >
                      {selectedPlayer ? `+ Add ${selectedPlayer.name}` : "Select a player to add"}
                    </button>

                    {members.length > 4 && (
                      <div className={s.groupWarn}>
                        {members.length} players — over the foursome limit
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
