"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Deal } from "@/lib/crm/types";
import { fmtDate } from "@/lib/crm/format";
import { nextSortState, sortDeals, type SortCol, type SortState } from "@/lib/crm/sort";
import { ARCHIVE_STATUSES, stageColor, stageKey, UNSTAGED } from "@/lib/crm/stages";
import SortTh from "./SortTh";

// The archive's columns, in display order. A subset of the main table's, in a
// different order — hence the explicit list rather than SORT_COLUMNS.
const COLUMNS: { col: SortCol; label: string }[] = [
  { col: "company", label: "Company" },
  { col: "category", label: "Category" },
  { col: "stage", label: "Status" },
  { col: "priority", label: "Pri" },
  { col: "fund", label: "Fund" },
  { col: "date", label: "Date" },
];

// The archive: searchable, filterable by parked status, with one-click restore.
export default function CrmArchive() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<SortState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/crm?view=archive")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => alive && setDeals(d.deals ?? []))
      .catch(() => alive && setError("Couldn't load the archive."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const statuses = useMemo(() => {
    const present = new Set(deals.map(stageKey));
    return [...ARCHIVE_STATUSES, UNSTAGED].filter((s) => present.has(s));
  }, [deals]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter((d) => {
      if (statusFilter !== "all" && stageKey(d) !== statusFilter) return false;
      if (q) {
        const hay = `${d.company} ${d.category ?? ""} ${d.contactName ?? ""} ${d.contactEmail ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [deals, query, statusFilter]);

  const rows = useMemo(() => sortDeals(filtered, sort), [filtered, sort]);

  async function restore(d: Deal) {
    setBusyId(d.id);
    try {
      const res = await fetch(`/api/crm/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Parked statuses aren't board columns — restoring puts it in New.
        body: JSON.stringify({
          origin: d.origin,
          archived: false,
          ...(ARCHIVE_STATUSES.includes(stageKey(d)) || stageKey(d) === UNSTAGED
            ? { stage: "New" }
            : {}),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDeals((ds) => ds.filter((x) => x.id !== d.id));
    } catch {
      /* leave the row in place */
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p style={{ opacity: 0.6 }}>Loading archive…</p>;
  if (error) return <p style={{ opacity: 0.7 }}>{error}</p>;

  return (
    <div>
      <div className="tool-toolbar" style={{ flexWrap: "wrap", margin: "0 0 0.9rem" }}>
        <input
          className="tool-input"
          type="search"
          placeholder="Search archived deals…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: "1 1 240px", maxWidth: 340 }}
        />
        <span className="tool-count">{filtered.length} archived</span>
        <select
          className="tool-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ marginLeft: "auto" }}
        >
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <p style={{ opacity: 0.6 }}>Nothing in the archive matches.</p>
      ) : (
        <div className="tool-table-wrap">
          <table className="tool-table crm-table">
            <thead>
              <tr>
                {COLUMNS.map(({ col, label }) => (
                  <SortTh
                    key={col}
                    col={col}
                    label={label}
                    sort={sort}
                    onSort={(c) => setSort((cur) => nextSortState(cur, c))}
                  />
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const st = stageKey(d);
                return (
                  <tr key={d.id} className="clickable" onClick={() => router.push(`/crm/${d.id}`)}>
                    <td style={{ fontWeight: 600 }}>{d.company}</td>
                    <td>
                      {d.category || <span style={{ opacity: 0.35 }}>—</span>}
                      {d.subcategory ? <span style={{ opacity: 0.5 }}> · {d.subcategory}</span> : null}
                    </td>
                    <td>
                      <span className="crm-stage-tag" style={{ background: stageColor(st) }}>
                        {st === UNSTAGED ? "—" : st}
                      </span>
                    </td>
                    <td>
                      {d.priority != null ? (
                        <span className={`crm-pri${d.priority >= 5 ? " crm-pri--high" : ""}`}>P{d.priority}</span>
                      ) : (
                        <span style={{ opacity: 0.35 }}>—</span>
                      )}
                    </td>
                    <td>{d.fund ? <span className="crm-fund-chip">{d.fund}</span> : <span style={{ opacity: 0.35 }}>—</span>}</td>
                    <td className="crm-td-date">{fmtDate(d.date)}</td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                      <button
                        className="tool-btn"
                        type="button"
                        disabled={busyId === d.id}
                        onClick={() => restore(d)}
                      >
                        {busyId === d.id ? "Restoring…" : "Restore"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
