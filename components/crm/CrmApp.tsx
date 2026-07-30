"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Deal, DealOrigin } from "@/lib/crm/types";
import { fmtDate } from "@/lib/crm/format";
import {
  nextSortState,
  parseSortState,
  sortDeals,
  SORT_COLUMNS,
  SORT_TH_LABELS,
  type SortCol,
  type SortState,
} from "@/lib/crm/sort";
import { ARCHIVE_STATUSES, FUNDS, stageColor, stageKey, stageList } from "@/lib/crm/stages";
import { downloadCsv } from "@/lib/export/csv";
import CrmBoard from "./CrmBoard";
import NewResponses from "./NewResponses";
import SortTh from "./SortTh";
import AddCompanyModal from "./AddCompanyModal";

type View = "board" | "table";

// Sort + view survive clicking into a deal and coming back, which is most of
// what makes column sorting usable day to day.
const SORT_KEY = "crm:sort";
const VIEW_KEY = "crm:view";

// The whole deal book — every deal ever, active and parked, so the CRM is the
// single source of truth. The scope pills narrow to the active pipeline or the
// parked history; fund tabs scope everything below them — summary, table, and
// board. The parked triage view still lives at /crm/archive.
export default function CrmApp() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [newSince, setNewSince] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"all" | "active" | "parked">("all");
  const [fund, setFund] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  // One sort for the whole tool: the toolbar control and the table's headers
  // drive the same state, so switching Board ↔ Table never reshuffles on you.
  // null = the API's default order (newest first).
  const [sort, setSort] = useState<SortState>(null);
  const [view, setView] = useState<View>("board");
  const [showAdd, setShowAdd] = useState(false);

  // Restore the persisted sort/view after mount (never during render — the
  // server has no localStorage and the markup would mismatch). `hydrated`
  // gates the writers below: without it they'd fire on the same commit as
  // this reader, still holding the *initial* state, and overwrite the stored
  // preference with the default before the restore lands.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const rawSort = window.localStorage.getItem(SORT_KEY);
      if (rawSort) setSort(parseSortState(JSON.parse(rawSort)));
      const rawView = window.localStorage.getItem(VIEW_KEY);
      if (rawView === "board" || rawView === "table") setView(rawView);
    } catch {
      /* private mode / corrupt value — fall back to the defaults */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (sort) window.localStorage.setItem(SORT_KEY, JSON.stringify(sort));
      else window.localStorage.removeItem(SORT_KEY);
    } catch {
      /* noop */
    }
  }, [sort, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* noop */
    }
  }, [view, hydrated]);

  useEffect(() => {
    let alive = true;
    fetch("/api/crm?view=all")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!alive) return;
        setDeals(d.deals ?? []);
        setArchivedCount(d.archivedCount ?? 0);
        setNewIds(d.newIds ?? []);
        setNewSince(d.newSince ?? null);
      })
      .catch(() => alive && setError("Couldn't load the pipeline."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // ── "New since you last looked" bookkeeping ──────────────────────────────
  // The watermark moves in exactly two places: the tray's own button, and
  // pagehide (closing the tab / backgrounding the app) once the tray has been
  // on screen. Deliberately NOT on GET /api/crm and NOT on unmount — a refresh
  // or a click into a deal and back would otherwise wipe the list before it
  // had been read.
  const pendingAck = useRef(false);
  useEffect(() => {
    pendingAck.current = newIds.length > 0;
  }, [newIds]);

  useEffect(() => {
    const flush = () => {
      if (!pendingAck.current) return;
      pendingAck.current = false;
      // sendBeacon survives the page going away; fetch wouldn't.
      navigator.sendBeacon?.("/api/crm/seen");
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const acknowledgeNew = useCallback(() => {
    pendingAck.current = false;
    setNewIds([]);
    setNewSince(new Date().toISOString());
    void fetch("/api/crm/seen", { method: "POST" }).catch(() => {
      /* the beacon on unload is the backstop */
    });
  }, []);

  const newSet = useMemo(() => new Set(newIds), [newIds]);

  // Scope pills narrow the book; fund tab scopes everything below it.
  const inScope = useMemo(
    () =>
      scope === "all" ? deals : deals.filter((d) => d.archived === (scope === "parked")),
    [deals, scope],
  );
  const inFund = useMemo(
    () => (fund === "all" ? inScope : inScope.filter((d) => d.fund === fund)),
    [inScope, fund],
  );

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of inFund) c[stageKey(d)] = (c[stageKey(d)] ?? 0) + 1;
    return c;
  }, [inFund]);

  const stages = useMemo(() => stageList(inFund), [inFund]);

  const categories = useMemo(
    () => [...new Set(inFund.map((d) => d.category).filter(Boolean))].sort() as string[],
    [inFund],
  );

  // Everything except the stage filter (the board shows all stages as columns).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inFund.filter((d) => {
      if (category !== "all" && d.category !== category) return false;
      if (priority === "unrated") {
        if (d.priority != null) return false;
      } else if (priority !== "all" && String(d.priority ?? "") !== priority) {
        return false;
      }
      if (q) {
        const hay = `${d.company} ${d.contactName ?? ""} ${d.contactEmail ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [inFund, query, category, priority]);

  // One sorted list feeds both views: the board's card order within each column
  // and the table's rows. Empty values always sink, whichever way you sort.
  const sorted = useMemo(() => sortDeals(filtered, sort), [filtered, sort]);

  // The table additionally honours the stage pills (the board splits by stage).
  const tableRows = useMemo(
    () => (stage === "all" ? sorted : sorted.filter((d) => stageKey(d) === stage)),
    [sorted, stage],
  );

  // Click a header: desc → asc → off. A new column starts descending, so the
  // biggest thing lands on top.
  function onHeaderSort(col: SortCol) {
    setSort((cur) => nextSortState(cur, col));
  }

  // Untriaged inbound only — the number that should demand attention.
  const newCount = useMemo(
    () => inFund.filter((d) => d.origin === "form" && stageKey(d) === "New").length,
    [inFund],
  );

  const activeCount = useMemo(() => inFund.filter((d) => !d.archived).length, [inFund]);
  const unratedCount = useMemo(
    () => inFund.filter((d) => d.priority == null).length,
    [inFund],
  );

  function exportCsv() {
    const rows = tableRows.map((d) => ({
      Company: d.company,
      Fund: d.fund ?? "",
      Category: d.category ?? "",
      Subcategory: d.subcategory ?? "",
      Stage: stageKey(d),
      Priority: d.priority ?? "",
      Contact: d.contactName ?? "",
      Email: d.contactEmail ?? "",
      Date: d.date ?? "",
      Origin: d.origin,
    }));
    downloadCsv(`crm-deals-${rows.length}.csv`, rows, [
      "Company", "Fund", "Category", "Subcategory", "Stage", "Priority", "Contact", "Email", "Date", "Origin",
    ]);
  }

  // Drag-to-restage: optimistic update + PATCH, revert on failure. Keeps the
  // single `deals` list authoritative so table and board never disagree.
  // Dragging a parked deal onto a pipeline column restores it in the same move.
  async function onMove(id: string, origin: DealOrigin, newStage: string) {
    const prev = deals;
    const moved = deals.find((d) => d.id === id);
    const restore = !!moved?.archived && !ARCHIVE_STATUSES.includes(newStage);
    setDeals((ds) =>
      ds.map((d) =>
        d.id === id ? { ...d, stage: newStage, archived: restore ? false : d.archived } : d,
      ),
    );
    try {
      const res = await fetch(`/api/crm/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, stage: newStage, ...(restore ? { archived: false } : {}) }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setDeals(prev);
    }
  }

  if (loading) return <p style={{ opacity: 0.6 }}>Loading pipeline…</p>;
  if (error) return <p style={{ opacity: 0.7 }}>{error}</p>;

  return (
    <div>
      {/* what came in since you last looked */}
      <NewResponses
        deals={deals}
        newIds={newIds}
        newSince={newSince}
        onAcknowledge={acknowledgeNew}
      />

      {/* fund tabs — the primary lens */}
      <div className="crm-funds">
        <FundTab label="All funds" active={fund === "all"} count={inScope.length} onClick={() => setFund("all")} />
        {FUNDS.map((f) => (
          <FundTab
            key={f}
            label={f}
            active={fund === f}
            count={inScope.filter((d) => d.fund === f).length}
            onClick={() => setFund(f)}
          />
        ))}
        <div className="crm-scope">
          <ScopePill label="All deals" active={scope === "all"} onClick={() => setScope("all")} />
          <ScopePill label="Active" active={scope === "active"} onClick={() => setScope("active")} />
          <ScopePill label="Parked" active={scope === "parked"} onClick={() => setScope("parked")} />
        </div>
        <Link className="crm-archive-link" href="/crm/archive">
          Archive <span className="tool-count">{archivedCount}</span>
        </Link>
      </div>

      {/* pipeline summary strip */}
      <div className="crm-summary">
        <div className="crm-sumcard">
          <div className="crm-sumcard-v">{inFund.length}</div>
          <div className="crm-sumcard-l">Total deals</div>
        </div>
        <div className="crm-sumcard">
          <div className="crm-sumcard-v">{activeCount}</div>
          <div className="crm-sumcard-l">Active pipeline</div>
        </div>
        <div className="crm-sumcard">
          <div className="crm-sumcard-v">{newCount}</div>
          <div className="crm-sumcard-l">New leads</div>
        </div>
        <div className="crm-sumcard">
          <div className="crm-sumcard-v">{unratedCount}</div>
          <div className="crm-sumcard-l">Unrated</div>
        </div>
        <div className="crm-stagebar-wrap">
          <div className="crm-stagebar" role="img" aria-label="Deals by stage">
            {stages.map((s) => {
              const w = inFund.length ? (stageCounts[s] / inFund.length) * 100 : 0;
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
          placeholder="Search company or contact…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: "1 1 240px", maxWidth: 340 }}
        />
        <span className="tool-count">
          {filtered.length} deals{newCount ? ` · ${newCount} new` : ""}
        </span>
        <div style={{ display: "flex", gap: "0.4rem", marginLeft: "auto", flexWrap: "wrap" }}>
          <select className="tool-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className="tool-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="all">All priorities</option>
            {[6, 5, 4, 3, 2, 1].map((p) => (
              <option key={p} value={String(p)}>P{p}{p === 6 ? " (top)" : ""}</option>
            ))}
            <option value="unrated">Unrated only</option>
          </select>

          {/* one sort control for board + table; the table headers set the same state */}
          <div className="crm-sortctl">
            <select
              className="tool-select"
              value={sort?.col ?? ""}
              onChange={(e) =>
                setSort(e.target.value ? { col: e.target.value as SortCol, dir: "desc" } : null)
              }
              title="Sort deals"
            >
              <option value="">Sort: Newest first</option>
              {SORT_COLUMNS.map(({ col, label }) => (
                <option key={col} value={col}>Sort: {label}</option>
              ))}
            </select>
            <button
              type="button"
              className="crm-sortdir"
              disabled={!sort}
              onClick={() => setSort((s) => (s ? { ...s, dir: s.dir === "asc" ? "desc" : "asc" } : s))}
              title={sort?.dir === "asc" ? "Ascending — click for descending" : "Descending — click for ascending"}
              aria-label="Toggle sort direction"
            >
              {sort?.dir === "asc" ? "▲" : "▼"}
            </button>
          </div>

          <button className="tool-btn" type="button" onClick={exportCsv} disabled={tableRows.length === 0} title="Download the current view as CSV">
            ↓ Export CSV
          </button>
          <button className="tool-btn tool-btn--solid" type="button" onClick={() => setShowAdd(true)}>
            + Add company
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
        <div className="crm-stagepills">
          <StagePill label="All" count={inFund.length} active={stage === "all"} onClick={() => setStage("all")} />
          {stages.map((s) => (
            <StagePill key={s} label={s} count={stageCounts[s]} active={stage === s} color={stageColor(s)} onClick={() => setStage(s)} />
          ))}
        </div>
      )}

      {view === "board" ? (
        sorted.length === 0 ? (
          <p style={{ opacity: 0.6 }}>No deals match.</p>
        ) : (
          <CrmBoard deals={sorted} onMove={onMove} newIds={newSet} />
        )
      ) : tableRows.length === 0 ? (
        <p style={{ opacity: 0.6 }}>No deals match.</p>
      ) : (
        <div className="tool-table-wrap">
          <table className="tool-table crm-table">
            <thead>
              <tr>
                {SORT_COLUMNS.map(({ col }) => (
                  <SortTh
                    key={col}
                    col={col}
                    label={SORT_TH_LABELS[col]}
                    sort={sort}
                    onSort={onHeaderSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((d) => {
                const st = stageKey(d);
                return (
                  <tr key={d.id} className="clickable" onClick={() => router.push(`/crm/${d.id}`)}>
                    <td style={{ fontWeight: 600 }}>
                      {d.company}
                      {newSet.has(d.id) && <span className="crm-badge-new">NEW</span>}
                      {scope === "all" && d.archived && <span className="crm-parked-tag">parked</span>}
                    </td>
                    <td>{d.fund ? <span className="crm-fund-chip">{d.fund}</span> : <span style={{ opacity: 0.35 }}>—</span>}</td>
                    <td>
                      {d.category || <span style={{ opacity: 0.35 }}>—</span>}
                      {d.subcategory ? <span style={{ opacity: 0.5 }}> · {d.subcategory}</span> : null}
                    </td>
                    <td>
                      <span className="crm-stage-tag" style={{ background: stageColor(st) }}>{st}</span>
                    </td>
                    <td>
                      {d.priority != null ? (
                        <span className={`crm-pri${d.priority >= 5 ? " crm-pri--high" : ""}`}>P{d.priority}</span>
                      ) : (
                        <span className="crm-pri crm-pri--unrated">unrated</span>
                      )}
                    </td>
                    <td>
                      {d.contactName || <span style={{ opacity: 0.4 }}>—</span>}
                      {d.contactEmail && <div className="crm-td-sub">{d.contactEmail}</div>}
                    </td>
                    <td className="crm-td-date">{fmtDate(d.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddCompanyModal onAdd={(deal) => setDeals((ds) => [deal, ...ds])} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function FundTab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`crm-fund-tab${active ? " crm-fund-tab--active" : ""}`} onClick={onClick}>
      {label}
      <span className="crm-fund-tab-count">{count}</span>
    </button>
  );
}

function ScopePill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`crm-scope-pill${active ? " crm-scope-pill--active" : ""}`} onClick={onClick}>
      {label}
    </button>
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
