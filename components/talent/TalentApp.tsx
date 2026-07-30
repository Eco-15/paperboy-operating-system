"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TalentRec } from "@/lib/talent/types";
import { stageColor, stageKey, stageList } from "@/lib/talent/stages";
import { downloadCsv } from "@/lib/export/csv";
import TalentBoard from "./TalentBoard";
import AddTalentModal from "./AddTalentModal";

function fmtDate(v: string | null): string {
  if (!v) return "";
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) return v;
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// The active talent roster (unarchived people). Mirrors components/crm/CrmApp
// minus the fund tabs — one roster, filtered by role instead. The parked
// history lives at /talent/archive.
export default function TalentApp() {
  const router = useRouter();
  const [talent, setTalent] = useState<TalentRec[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [role, setRole] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"default" | "pri-high" | "pri-low">("default");
  const [view, setView] = useState<"board" | "table">("board");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/talent")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!alive) return;
        setTalent(d.talent ?? []);
        setArchivedCount(d.archivedCount ?? 0);
      })
      .catch(() => alive && setError("Couldn't load the roster."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of talent) c[stageKey(t)] = (c[stageKey(t)] ?? 0) + 1;
    return c;
  }, [talent]);

  const stages = useMemo(() => stageList(talent), [talent]);

  const roles = useMemo(
    () => [...new Set(talent.map((t) => t.role).filter(Boolean))].sort() as string[],
    [talent],
  );

  // Everything except the stage filter (the board shows all stages as columns).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return talent.filter((t) => {
      if (role !== "all" && t.role !== role) return false;
      if (priority !== "all" && String(t.priority ?? "") !== priority) return false;
      if (q) {
        const hay = `${t.name} ${t.role ?? ""} ${t.company ?? ""} ${t.email ?? ""} ${t.location ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [talent, query, role, priority]);

  // Sort applies after filtering; people without a priority sink to the bottom.
  const sorted = useMemo(() => {
    if (sortBy === "default") return filtered;
    const dir = sortBy === "pri-high" ? -1 : 1;
    return [...filtered].sort((a, b) => {
      if (a.priority == null && b.priority == null) return 0;
      if (a.priority == null) return 1;
      if (b.priority == null) return -1;
      return (a.priority - b.priority) * dir;
    });
  }, [filtered, sortBy]);

  // Table additionally honours the stage-pill filter.
  const tableRows = useMemo(
    () => (stage === "all" ? sorted : sorted.filter((t) => stageKey(t) === stage)),
    [sorted, stage],
  );

  const newCount = useMemo(
    () => talent.filter((t) => stageKey(t) === "New").length,
    [talent],
  );

  function exportCsv() {
    const rows = tableRows.map((t) => ({
      Name: t.name,
      Role: t.role ?? "",
      Company: t.company ?? "",
      Stage: stageKey(t),
      Priority: t.priority ?? "",
      Email: t.email ?? "",
      Link: t.link ?? "",
      Location: t.location ?? "",
      Date: t.date ?? "",
      Source: t.source ?? "",
    }));
    downloadCsv(`talent-roster-${rows.length}.csv`, rows, [
      "Name", "Role", "Company", "Stage", "Priority", "Email", "Link", "Location", "Date", "Source",
    ]);
  }

  // Drag-to-restage: optimistic update + PATCH, revert on failure.
  async function onMove(id: string, newStage: string) {
    const prev = talent;
    setTalent((ts) => ts.map((t) => (t.id === id ? { ...t, stage: newStage } : t)));
    try {
      const res = await fetch(`/api/talent/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setTalent(prev);
    }
  }

  if (loading) return <p style={{ opacity: 0.6 }}>Loading roster…</p>;
  if (error) return <p style={{ opacity: 0.7 }}>{error}</p>;

  return (
    <div>
      {/* roster summary strip */}
      <div className="crm-funds">
        <span className="crm-fund-tab crm-fund-tab--active" style={{ cursor: "default" }}>
          Roster
          <span className="crm-fund-tab-count">{talent.length}</span>
        </span>
        <Link className="crm-archive-link" href="/talent/archive">
          Archive <span className="tool-count">{archivedCount}</span>
        </Link>
      </div>

      <div className="crm-summary">
        <div className="crm-sumcard">
          <div className="crm-sumcard-v">{talent.length}</div>
          <div className="crm-sumcard-l">On roster</div>
        </div>
        <div className="crm-sumcard">
          <div className="crm-sumcard-v">{newCount}</div>
          <div className="crm-sumcard-l">New</div>
        </div>
        <div className="crm-sumcard">
          <div className="crm-sumcard-v">{stageCounts["Interviewing"] ?? 0}</div>
          <div className="crm-sumcard-l">Interviewing</div>
        </div>
        <div className="crm-sumcard">
          <div className="crm-sumcard-v">{stageCounts["Placed"] ?? 0}</div>
          <div className="crm-sumcard-l">Placed</div>
        </div>
        <div className="crm-stagebar-wrap">
          <div className="crm-stagebar" role="img" aria-label="People by stage">
            {stages.map((s) => {
              const w = talent.length ? (stageCounts[s] / talent.length) * 100 : 0;
              return w > 0 ? (
                <span key={s} title={`${s}: ${stageCounts[s]}`} style={{ width: `${w}%`, background: stageColor(s) }} />
              ) : null;
            })}
          </div>
          <div className="crm-stagebar-legend">
            {stages.map((s) => (
              <span key={s} className="crm-legend-item">
                <i style={{ background: stageColor(s) }} />
                {s} {stageCounts[s]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* search + filters + actions */}
      <div className="tool-toolbar" style={{ flexWrap: "wrap", margin: "0 0 0.9rem" }}>
        <input
          className="tool-input"
          type="search"
          placeholder="Search name, role, or company…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: "1 1 240px", maxWidth: 340 }}
        />
        <span className="tool-count">
          {filtered.length} people{newCount ? ` · ${newCount} new` : ""}
        </span>
        <div style={{ display: "flex", gap: "0.4rem", marginLeft: "auto", flexWrap: "wrap" }}>
          <select className="tool-select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">All roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select className="tool-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="all">All priorities</option>
            {[6, 5, 4, 3, 2, 1].map((p) => (
              <option key={p} value={String(p)}>P{p}{p === 6 ? " (top)" : ""}</option>
            ))}
          </select>
          <select
            className="tool-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "default" | "pri-high" | "pri-low")}
            title="Sort people"
          >
            <option value="default">Sort: Default</option>
            <option value="pri-high">Sort: Priority high → low</option>
            <option value="pri-low">Sort: Priority low → high</option>
          </select>
          <button className="tool-btn" type="button" onClick={exportCsv} disabled={tableRows.length === 0} title="Download the current view as CSV">
            ↓ Export CSV
          </button>
          <button className="tool-btn tool-btn--solid" type="button" onClick={() => setShowAdd(true)}>
            + Add person
          </button>
        </div>
      </div>

      {/* view tabs */}
      <div className="crm-tabs">
        <button type="button" className={`crm-tab${view === "board" ? " crm-tab--active" : ""}`} onClick={() => setView("board")}>
          Board
        </button>
        <button type="button" className={`crm-tab${view === "table" ? " crm-tab--active" : ""}`} onClick={() => setView("table")}>
          Table
        </button>
      </div>

      {/* stage pills — table view only (the board already splits by stage) */}
      {view === "table" && (
        <div style={{ display: "flex", gap: "0.4rem", margin: "0 0 1rem", flexWrap: "wrap" }}>
          <StagePill label="All" count={talent.length} active={stage === "all"} onClick={() => setStage("all")} />
          {stages.map((s) => (
            <StagePill key={s} label={s} count={stageCounts[s]} active={stage === s} color={stageColor(s)} onClick={() => setStage(s)} />
          ))}
        </div>
      )}

      {view === "board" ? (
        sorted.length === 0 ? (
          <p style={{ opacity: 0.6 }}>No people match.</p>
        ) : (
          <TalentBoard talent={sorted} onMove={onMove} />
        )
      ) : tableRows.length === 0 ? (
        <p style={{ opacity: 0.6 }}>No people match.</p>
      ) : (
        <div className="tool-table-wrap">
          <table className="tool-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Company</th>
                <th>Stage</th>
                <th>Pri</th>
                <th>Contact</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((t) => {
                const st = stageKey(t);
                return (
                  <tr key={t.id} className="clickable" onClick={() => router.push(`/talent/${t.id}`)}>
                    <td style={{ fontWeight: 600 }}>
                      {t.name}
                      {t.source === "Talent network signup" && st === "New" && <span className="crm-badge-new">NEW</span>}
                    </td>
                    <td>{t.role || <span style={{ opacity: 0.35 }}>—</span>}</td>
                    <td>{t.company || <span style={{ opacity: 0.35 }}>—</span>}</td>
                    <td>
                      <span className="crm-stage-tag" style={{ background: stageColor(st) }}>{st}</span>
                    </td>
                    <td>
                      {t.priority != null ? (
                        <span className={`crm-pri${t.priority >= 5 ? " crm-pri--high" : ""}`}>P{t.priority}</span>
                      ) : (
                        <span style={{ opacity: 0.35 }}>—</span>
                      )}
                    </td>
                    <td>
                      {t.email || <span style={{ opacity: 0.4 }}>—</span>}
                      {t.location && <div style={{ fontSize: "0.78rem", opacity: 0.55 }}>{t.location}</div>}
                    </td>
                    <td style={{ whiteSpace: "nowrap", opacity: 0.7 }}>{fmtDate(t.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddTalentModal onAdd={(p) => setTalent((ts) => [p, ...ts])} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function StagePill({ label, count, active, color, onClick }: { label: string; count: number; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button type="button" className={`crm-pill${active ? " crm-pill--active" : ""}`} style={active ? { background: color ?? "var(--ink, #111)", borderColor: "transparent", color: "#fff" } : undefined} onClick={onClick}>
      {label}
      <span style={{ opacity: 0.65 }}>{count}</span>
    </button>
  );
}
