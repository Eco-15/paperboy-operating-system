"use client";

import { useMemo, useState } from "react";
import type { ApplicationRecord } from "@/lib/onePager/types";
import { sampleRecords } from "@/lib/onePager/sampleRecords";

export default function OnePagerApp() {
  // ── Data source ──────────────────────────────────────────────
  // TODO(backend): replace the mock with `loadRecords()` below once the
  // Python pipeline service (scripts/server.py) is wired up.
  //
  //   async function loadRecords() {
  //     const res = await fetch("/api/records");
  //     const data = await res.json();
  //     setRecords(data.records ?? []);
  //   }
  //
  const [records] = useState<ApplicationRecord[]>(sampleRecords);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const name = `${r.first_name} ${r.last_name}`.toLowerCase();
      return (
        r.company.toLowerCase().includes(q) ||
        name.includes(q) ||
        r.email.toLowerCase().includes(q)
      );
    });
  }, [records, query]);

  // TODO(backend): wire to `new EventSource('/api/generate/' + id)` and stream
  // log lines into the progress panel. Disabled until the pipeline is connected.
  const backendReady = false;

  return (
    <>
      <div className="onepager-note">
        Backend pending — applications shown are sample data. Connect the Python
        pipeline (scripts/server.py) to load live Airtable records and enable
        one-pager generation.
      </div>

      <div className="tool-toolbar">
        <input
          className="tool-input"
          type="search"
          placeholder="Search companies, contacts, email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="tool-btn" type="button" disabled title="Backend pending">
          Refresh
        </button>
        <span className="tool-count">
          {filtered.length} of {records.length} applications
        </span>
      </div>

      <div className="tool-table-wrap">
        <table className="tool-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>
                  No applications match your search.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const done = r.one_pager_url.trim().length > 0;
              return (
                <tr key={r.id}>
                  <td>
                    <div>{r.company || "—"}</div>
                    {r.website && (
                      <div className="tool-sub-line">
                        {r.website.replace(/^https?:\/\//, "")}
                      </div>
                    )}
                  </td>
                  <td>{`${r.first_name} ${r.last_name}`.trim() || "—"}</td>
                  <td>{r.email || "—"}</td>
                  <td>
                    {done ? (
                      <span className="tool-badge tool-badge--done">● Done</span>
                    ) : (
                      <span className="tool-badge tool-badge--pending">○ Pending</span>
                    )}
                  </td>
                  <td>
                    {done ? (
                      <a
                        className="tool-btn"
                        href={r.one_pager_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View PDF
                      </a>
                    ) : (
                      <button
                        className="tool-btn"
                        type="button"
                        disabled={!backendReady}
                        title="Backend pending"
                      >
                        Generate
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* SSE progress target for later — hidden until generation runs. */}
      <div className="onepager-progress" hidden>
        <div className="onepager-progress-head">Generation log</div>
        <div className="onepager-log" />
      </div>
    </>
  );
}
