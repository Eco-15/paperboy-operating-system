"use client";

import { useMemo, useState } from "react";
import { useVoteState } from "@/lib/poker/useVoteState";
import type { Player } from "@/lib/poker/types";
import Leaderboard from "./Leaderboard";
import PokerCharts from "./PokerCharts";
import VoteModal from "./VoteModal";
import AddPlayerModal from "./AddPlayerModal";

type Tab = "leaderboard" | "analytics";

function fmtTime(ts: string): string {
  const d = new Date(ts);
  return (
    d.toLocaleDateString() +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

export default function PokerApp() {
  const vs = useVoteState();
  const [tab, setTab] = useState<Tab>("leaderboard");
  const [activeName, setActiveName] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [showEliminated, setShowEliminated] = useState(true);

  const stats = useMemo(() => {
    const real = vs.players.filter((p) => p.name !== "HOLD");
    const active = real.filter((p) => !vs.eliminated.has(p.name));
    const totalVotes = real.reduce((s, p) => s + p.votes, 0);
    const leading = active.reduce<Player | null>(
      (a, b) => (a && a.votes >= b.votes ? a : b),
      null
    );
    return {
      players: real.length,
      remaining: real.length - vs.eliminated.size,
      eliminated: vs.eliminated.size,
      totalVotes,
      leader: leading && leading.votes > 0 ? leading.name.split(" ")[0] : "—",
    };
  }, [vs.players, vs.eliminated]);

  const activePlayer = activeName
    ? vs.players.find((p) => p.name === activeName) || null
    : null;
  const activeHistory = activeName
    ? vs.voteLog.filter((e) => e.playerName === activeName)
    : [];

  return (
    <>
      {/* Status bar */}
      <div className="poker-status">
        <span>{vs.status}</span>
        <div className="poker-status-actions">
          <button
            className="poker-mini-btn"
            type="button"
            onClick={() => setShowEliminated((s) => !s)}
          >
            {showEliminated ? "hide eliminated" : "show eliminated"}
          </button>
          <button className="poker-mini-btn" type="button" onClick={vs.seedTestData}>
            seed test data
          </button>
          <button className="poker-mini-btn" type="button" onClick={vs.clearTestData}>
            clear test data
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="poker-stats">
        <div className="poker-stat">
          <div className="poker-stat-label">Players</div>
          <div className="poker-stat-value">{stats.players}</div>
        </div>
        <div className="poker-stat">
          <div className="poker-stat-label">Remaining</div>
          <div className="poker-stat-value">{stats.remaining}</div>
        </div>
        <div className="poker-stat">
          <div className="poker-stat-label">Eliminated</div>
          <div
            className="poker-stat-value"
            style={stats.eliminated > 0 ? { color: "#8b0000" } : undefined}
          >
            {stats.eliminated}
          </div>
        </div>
        <div className="poker-stat">
          <div className="poker-stat-label">Total Votes</div>
          <div className="poker-stat-value">{stats.totalVotes}</div>
        </div>
        <div className="poker-stat">
          <div className="poker-stat-label">Leader</div>
          <div className="poker-stat-value" style={{ fontSize: "1.3rem" }}>
            {stats.leader}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="poker-tabs">
        <button
          className={`poker-tab ${tab === "leaderboard" ? "poker-tab--active" : ""}`}
          type="button"
          onClick={() => setTab("leaderboard")}
        >
          Leaderboard
        </button>
        <button
          className={`poker-tab ${tab === "analytics" ? "poker-tab--active" : ""}`}
          type="button"
          onClick={() => setTab("analytics")}
        >
          Analytics
        </button>
      </div>

      {tab === "leaderboard" ? (
        <Leaderboard
          players={vs.players}
          eliminated={vs.eliminated}
          showEliminated={showEliminated}
          onOpenPlayer={(p) => setActiveName(p.name)}
          onOpenAdd={() => setAddOpen(true)}
        />
      ) : (
        <>
          <PokerCharts players={vs.players} eliminated={vs.eliminated} />
          <div className="tool-panel" style={{ marginTop: 4 }}>
            <div className="tool-panel-title">Vote Log</div>
            {vs.voteLog.length === 0 ? (
              <div className="tool-sub-line">No votes logged yet.</div>
            ) : (
              <ul className="poker-log">
                {vs.voteLog.map((e) => (
                  <li className="poker-log-item" key={e.id}>
                    <div>
                      <div>{e.playerName}</div>
                      <div className="poker-log-meta">
                        voted by {e.caster} → total: {e.newTotal}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="poker-votes">+{e.delta}</span>
                      <span className="poker-log-meta">{fmtTime(e.ts)}</span>
                      <button
                        className="poker-mini-btn"
                        type="button"
                        onClick={() => vs.removeLogEntry(e.id)}
                      >
                        remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {activePlayer && (
        <VoteModal
          player={activePlayer}
          history={activeHistory}
          isEliminated={vs.eliminated.has(activePlayer.name)}
          onSubmit={(delta, caster) =>
            vs.submitVote(activePlayer.name, activePlayer.company, delta, caster)
          }
          onRemove={vs.removeLogEntry}
          onToggleEliminate={() => vs.toggleEliminate(activePlayer.name)}
          onClose={() => setActiveName(null)}
        />
      )}

      {addOpen && (
        <AddPlayerModal onAdd={vs.addPlayer} onClose={() => setAddOpen(false)} />
      )}
    </>
  );
}
