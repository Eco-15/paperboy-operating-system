"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Investor, SortCol, TypeCounts } from "@/lib/investors/types";
import { downloadCsv } from "@/lib/export/csv";
import InvestorTable from "./InvestorTable";
import InvestorModal from "./InvestorModal";
import InvestorPie from "./InvestorPie";

// D3 map touches the DOM and fetches topojson — load it client-only.
// Geographic pins are still sourced from the static dataset (no lat/lng in the
// DB yet); the tabular investor list now comes from the database.
const InvestorMap = dynamic(() => import("./InvestorMap"), {
  ssr: false,
  loading: () => <div className="tool-map-placeholder">Loading map…</div>,
});

export default function InvestorApp() {
  const [data, setData] = useState<Investor[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [state, setState] = useState("");
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [selected, setSelected] = useState<Investor | null>(null);
  const [copied, setCopied] = useState(false);

  // Honor a ?q= deep link (e.g. from the ⌘K command palette) as the initial search.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setQuery(q);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/investors")
      .then((r) => r.json())
      .then((json) => {
        if (active) setData(json.investors ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const TYPES: TypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of data) counts[r.Type] = (counts[r.Type] ?? 0) + 1;
    return counts;
  }, [data]);

  const STATES = useMemo(
    () =>
      Array.from(
        new Set(data.map((r) => r.State).filter((s): s is string => Boolean(s))),
      ).sort(),
    [data],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const res = data.filter((r) => {
      if (type && r.Type !== type) return false;
      if (state && r.State !== state) return false;
      if (
        q &&
        ![r["Group Name"], r.City, r.State, r.Summary, r.Type]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
    if (sortCol) {
      res.sort((a, b) => {
        const av = (a[sortCol] || "").toLowerCase();
        const bv = (b[sortCol] || "").toLowerCase();
        return av < bv ? -sortDir : av > bv ? sortDir : 0;
      });
    }
    return res;
  }, [data, query, type, state, sortCol, sortDir]);

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortCol(col);
      setSortDir(1);
    }
  }

  function clearAll() {
    setQuery("");
    setType("");
    setState("");
    setSortCol(null);
    setSortDir(1);
  }

  function exportCsv() {
    downloadCsv(
      `investors-${filtered.length}.csv`,
      filtered as unknown as Record<string, unknown>[],
      ["Group Name", "Type", "City", "State", "Website", "LinkedIn", "Summary"],
    );
  }

  // Copy the current results as tab-separated rows — pastes cleanly into an
  // email or spreadsheet for outreach.
  async function copyContacts() {
    const lines = filtered.map((r) =>
      [r["Group Name"], r.Type, [r.City, r.State].filter(Boolean).join(", "), r.Website ?? "", r.LinkedIn ?? ""].join("\t"),
    );
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <>
      <section className="tool-panels">
        <div className="tool-panel">
          <div className="tool-panel-title">Geographic distribution</div>
          <InvestorMap />
        </div>
        <div className="tool-panel">
          <div className="tool-panel-title">Investor type breakdown</div>
          <InvestorPie counts={TYPES} />
        </div>
      </section>

      <div className="tool-toolbar">
        <input
          className="tool-input"
          type="search"
          placeholder="Search by name, city, summary…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="tool-select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All Types</option>
          <option value="Angel Group">Angel Group</option>
          <option value="VC">VC</option>
          <option value="Family Office">Family Office</option>
        </select>
        <select className="tool-select" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">All States</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="tool-btn" type="button" onClick={clearAll}>
          Clear
        </button>
        <button
          className="tool-btn"
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          title="Download the current results as a CSV"
        >
          ↓ Export CSV
        </button>
        <button
          className="tool-btn"
          type="button"
          onClick={copyContacts}
          disabled={filtered.length === 0}
          title="Copy the current results (name, type, location, links) to paste into email or a sheet"
        >
          {copied ? "✓ Copied" : "⧉ Copy"}
        </button>
        <span className="tool-count">
          {loaded
            ? `${filtered.length} of ${data.length} investors`
            : "Loading investors…"}
        </span>
      </div>

      <InvestorTable
        rows={filtered}
        sortCol={sortCol}
        sortDir={sortDir}
        onSort={handleSort}
        onSelect={setSelected}
      />

      {selected && <InvestorModal row={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
