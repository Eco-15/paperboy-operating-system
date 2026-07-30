"use client";

import { useMemo, useState } from "react";
import type { Player, SortKey } from "@/lib/poker/types";

export default function Leaderboard({
  players,
  eliminated,
  showEliminated,
  onOpenPlayer,
  onOpenAdd,
}: {
  players: Player[];
  eliminated: Set<string>;
  showEliminated: boolean;
  onOpenPlayer: (p: Player) => void;
  onOpenAdd: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("votes");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  function sortBy(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    else {
      setSortKey(key);
      setSortDir(-1);
    }
  }

  const { rows, maxVotes } = useMemo(() => {
    const q = query.toLowerCase();
    const real = players.filter((p) => p.name !== "HOLD");
    const sorted = [...real].sort((a, b) => {
      if (sortKey === "votes") return sortDir * (b.votes - a.votes);
      if (sortKey === "pct") return sortDir * (b.pct - a.pct);
      if (sortKey === "name") return sortDir * a.name.localeCompare(b.name);
      return 0;
    });
    const mv = sorted[0]?.votes || 1;
    const filtered = sorted.filter((p) => {
      if (!showEliminated && eliminated.has(p.name)) return false;
      return (
        !q || p.name.toLowerCase().includes(q) || p.company.toLowerCase().includes(q)
      );
    });

    // Dense, elimination-aware ranking (mirrors renderTable in dashboard.html).
    let activeRank = 0;
    let lastActiveVotes = -1;
    const out = filtered.map((p) => {
      const isElim = eliminated.has(p.name);
      if (!isElim && p.votes !== lastActiveVotes) {
        activeRank++;
        lastActiveVotes = p.votes;
      }
      const rankDisplay = isElim ? "OUT" : p.votes > 0 ? String(activeRank) : "—";
      const isTop1 = !isElim && activeRank === 1 && p.votes > 0;
      return { p, isElim, rankDisplay, isTop1 };
    });
    return { rows: out, maxVotes: mv };
  }, [players, eliminated, showEliminated, query, sortKey, sortDir]);

  const arrow = sortDir === -1 ? " ↓" : " ↑";

  return (
    <>
      <div className="tool-toolbar">
        <input
          className="tool-input"
          type="search"
          placeholder="Search player or company…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="tool-btn tool-btn--solid" type="button" onClick={onOpenAdd}>
          + Add Player
        </button>
      </div>

      <div className="tool-table-wrap">
        <table className="tool-table">
          <thead>
            <tr>
              <th style={{ width: 56 }}>#</th>
              <th className="sortable" onClick={() => sortBy("name")}>
                Player{sortKey === "name" ? arrow : ""}
              </th>
              <th className="sortable" style={{ textAlign: "right" }} onClick={() => sortBy("votes")}>
                Votes{sortKey === "votes" ? arrow : ""}
              </th>
              <th className="sortable" style={{ textAlign: "right" }} onClick={() => sortBy("pct")}>
                %{sortKey === "pct" ? arrow : ""}
              </th>
              <th style={{ width: "30%" }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)" }}>
                  No results.
                </td>
              </tr>
            )}
            {rows.map(({ p, isElim, rankDisplay, isTop1 }) => {
              const barWidth = maxVotes > 0 ? (p.votes / maxVotes) * 100 : 0;
              return (
                <tr
                  key={p.name}
                  className={`clickable ${isElim ? "poker-out" : ""}`}
                  onClick={() => onOpenPlayer(p)}
                >
                  <td
                    className="poker-rank"
                    style={isTop1 ? { color: "var(--black)", fontWeight: 700 } : undefined}
                  >
                    {rankDisplay}
                  </td>
                  <td>
                    <div>
                      {p.name}
                      {isElim && <span className="poker-out-badge">OUT</span>}
                    </div>
                    <div className="tool-sub-line">{p.company}</div>
                  </td>
                  <td className="poker-votes" style={{ textAlign: "right" }}>
                    {p.votes}
                  </td>
                  <td style={{ textAlign: "right" }}>{(p.pct || 0).toFixed(1)}%</td>
                  <td>
                    <div className="poker-bar-bg">
                      <div className="poker-bar-fill" style={{ width: `${barWidth}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
