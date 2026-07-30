"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TalentRec } from "@/lib/talent/types";
import { ARCHIVE_STATUSES, stageColor, stageKey, UNSTAGED } from "@/lib/talent/stages";

function fmtDate(v: string | null): string {
  if (!v) return "";
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) return v;
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// The archive: searchable, filterable by parked status, with one-click restore.
export default function TalentArchive() {
  const router = useRouter();
  const [talent, setTalent] = useState<TalentRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/talent?view=archive")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => alive && setTalent(d.talent ?? []))
      .catch(() => alive && setError("Couldn't load the archive."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const statuses = useMemo(() => {
    const present = new Set(talent.map(stageKey));
    return [...ARCHIVE_STATUSES, UNSTAGED].filter((s) => present.has(s));
  }, [talent]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return talent.filter((t) => {
      if (statusFilter !== "all" && stageKey(t) !== statusFilter) return false;
      if (q) {
        const hay = `${t.name} ${t.role ?? ""} ${t.company ?? ""} ${t.email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [talent, query, statusFilter]);

  async function restore(t: TalentRec) {
    setBusyId(t.id);
    try {
      const res = await fetch(`/api/talent/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Parked statuses aren't board columns — restoring puts them in New.
        body: JSON.stringify({
          archived: false,
          ...(ARCHIVE_STATUSES.includes(stageKey(t)) || stageKey(t) === UNSTAGED
            ? { stage: "New" }
            : {}),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setTalent((ts) => ts.filter((x) => x.id !== t.id));
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
          placeholder="Search archived people…"
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

      {filtered.length === 0 ? (
        <p style={{ opacity: 0.6 }}>Nothing in the archive matches.</p>
      ) : (
        <div className="tool-table-wrap">
          <table className="tool-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Pri</th>
                <th>Company</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const st = stageKey(t);
                return (
                  <tr key={t.id} className="clickable" onClick={() => router.push(`/talent/${t.id}`)}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td>{t.role || <span style={{ opacity: 0.35 }}>—</span>}</td>
                    <td>
                      <span className="crm-stage-tag" style={{ background: stageColor(st) }}>
                        {st === UNSTAGED ? "—" : st}
                      </span>
                    </td>
                    <td>
                      {t.priority != null ? (
                        <span className={`crm-pri${t.priority >= 5 ? " crm-pri--high" : ""}`}>P{t.priority}</span>
                      ) : (
                        <span style={{ opacity: 0.35 }}>—</span>
                      )}
                    </td>
                    <td>{t.company || <span style={{ opacity: 0.35 }}>—</span>}</td>
                    <td style={{ whiteSpace: "nowrap", opacity: 0.7 }}>{fmtDate(t.date)}</td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                      <button
                        className="tool-btn"
                        type="button"
                        disabled={busyId === t.id}
                        onClick={() => restore(t)}
                      >
                        {busyId === t.id ? "Restoring…" : "Restore"}
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
