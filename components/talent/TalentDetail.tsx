"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TalentRec } from "@/lib/talent/types";
import { ALL_STATUSES, ARCHIVE_STATUSES, ASSIGNABLE_STAGES, stageColor, stageKey } from "@/lib/talent/stages";

function fmtDate(v: string | null): string {
  if (!v) return "";
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) return v;
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function extUrl(v: string | null): string | null {
  if (!v) return null;
  const m = v.match(/https?:\/\/[^\s)]+/);
  if (m) return m[0];
  return /^https?:\/\//.test(v) ? v : /^[\w.-]+\.[a-z]{2,}/i.test(v) ? `https://${v}` : null;
}

function host(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// Per-person editor. Mirrors components/crm/CrmDealDetail over the single
// `talent` table — edits stage, priority, role/company/location/link, notes,
// and archive/restore; PATCHes /api/talent/[id].
export default function TalentDetail({ person }: { person: TalentRec }) {
  const router = useRouter();
  const [stage, setStage] = useState(stageKey(person));
  const [priority, setPriority] = useState(person.priority != null ? String(person.priority) : "");
  const [role, setRole] = useState(person.role ?? "");
  const [company, setCompany] = useState(person.company ?? "");
  const [location, setLocation] = useState(person.location ?? "");
  const [link, setLink] = useState(person.link ?? "");
  const [notes, setNotes] = useState(person.notes ?? "");
  const [archived, setArchived] = useState(person.archived);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const linkUrl = extUrl(link || person.link);

  const dirty =
    stage !== stageKey(person) ||
    priority !== (person.priority != null ? String(person.priority) : "") ||
    role !== (person.role ?? "") ||
    company !== (person.company ?? "") ||
    location !== (person.location ?? "") ||
    link !== (person.link ?? "") ||
    notes !== (person.notes ?? "");

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/talent/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(String(res.status));
  }

  async function save() {
    setStatus("saving");
    try {
      await patch({
        stage,
        priority: priority ? Number(priority) : null,
        role: role || null,
        company: company || null,
        location: location || null,
        link: link || null,
        notes: notes || null,
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  async function toggleArchive() {
    const next = !archived;
    setArchived(next);
    try {
      await patch({ archived: next });
      router.refresh();
    } catch {
      setArchived(!next);
    }
  }

  return (
    <div className="crm-detail">
      {/* header: identity + status line */}
      <div className="crm-detail-head">
        <div>
          <div className="tool-title">
            {person.name}
            {person.source === "Talent network signup" && stageKey(person) === "New" && (
              <span className="crm-badge-new">NEW</span>
            )}
            {archived && <span className="crm-archived-tag">Archived</span>}
          </div>
          <div className="tool-sub">
            {person.role || "No role on file"}
            {person.company ? ` · ${person.company}` : ""}
            {person.source ? ` · via ${person.source}` : ""}
            {person.date ? ` · ${fmtDate(person.date)}` : ""}
          </div>
        </div>
        <div className="crm-detail-head-tags">
          {person.priority != null && (
            <span className={`crm-pri${person.priority >= 5 ? " crm-pri--high" : ""}`}>P{person.priority}</span>
          )}
          <span className="crm-stage-tag" style={{ background: stageColor(stage) }}>{stage}</span>
        </div>
      </div>

      <div className="crm-detail-grid">
        {/* Left: the person — links + contact */}
        <div className="crm-detail-main">
          <div className="tool-panel">
            <div className="tool-panel-title">Links</div>
            <div className="crm-materials">
              {linkUrl && (
                <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="crm-material">
                  <span className="crm-material-icon">⌂</span>
                  <span>
                    <span className="crm-material-name">
                      {host(linkUrl)?.includes("linkedin") ? "LinkedIn" : "Profile"}
                    </span>
                    <span className="crm-material-meta">{host(linkUrl)}</span>
                  </span>
                </a>
              )}
              {person.email && (
                <a href={`mailto:${person.email}`} className="crm-material">
                  <span className="crm-material-icon">✉</span>
                  <span>
                    <span className="crm-material-name">Email</span>
                    <span className="crm-material-meta">{person.email}</span>
                  </span>
                </a>
              )}
              {!linkUrl && !person.email && (
                <span className="tool-sub-line">No links on file.</span>
              )}
            </div>
          </div>

          <div className="tool-panel">
            <div className="tool-panel-title">Details</div>
            <dl className="crm-dl">
              <Row label="Email" value={person.email} href={person.email ? `mailto:${person.email}` : null} />
              <Row label="Location" value={location || person.location} />
              <Row label="Source" value={person.source} />
              <Row label="Added" value={person.date ? fmtDate(person.date) : null} />
            </dl>
          </div>
        </div>

        {/* Right: editable roster fields */}
        <div className="tool-panel crm-detail-side">
          <div className="tool-panel-title">Roster</div>

          <div className="tool-field">
            <label>Stage</label>
            <select
              className="tool-select"
              value={stage}
              onChange={(e) => {
                setStage(e.target.value);
                setStatus("idle");
              }}
            >
              <optgroup label="Pipeline">
                {ASSIGNABLE_STAGES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </optgroup>
              <optgroup label="Parked">
                {ARCHIVE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </optgroup>
              {/* Preserve an unknown/legacy stage so it isn't silently changed. */}
              {!ALL_STATUSES.includes(stage) && <option value={stage}>{stage}</option>}
            </select>
          </div>

          <div className="tool-field">
            <label>Priority</label>
            <select
              className="tool-select"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setStatus("idle");
              }}
            >
              <option value="">—</option>
              {[6, 5, 4, 3, 2, 1].map((p) => (
                <option key={p} value={String(p)}>P{p}{p === 6 ? " (top)" : ""}</option>
              ))}
            </select>
          </div>

          <div className="tool-field">
            <label>Role</label>
            <input
              className="tool-input"
              type="text"
              value={role}
              placeholder="e.g. Growth Marketing"
              onChange={(e) => {
                setRole(e.target.value);
                setStatus("idle");
              }}
            />
          </div>

          <div className="tool-field">
            <label>Company</label>
            <input
              className="tool-input"
              type="text"
              value={company}
              placeholder="Current employer"
              onChange={(e) => {
                setCompany(e.target.value);
                setStatus("idle");
              }}
            />
          </div>

          <div className="tool-field">
            <label>Location</label>
            <input
              className="tool-input"
              type="text"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setStatus("idle");
              }}
            />
          </div>

          <div className="tool-field">
            <label>LinkedIn / Portfolio</label>
            <input
              className="tool-input"
              type="text"
              value={link}
              placeholder="https://…"
              onChange={(e) => {
                setLink(e.target.value);
                setStatus("idle");
              }}
            />
          </div>

          <div className="tool-field">
            <label>Notes</label>
            <textarea
              className="tool-input"
              rows={6}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setStatus("idle");
              }}
            />
          </div>

          <div className="tool-modal-actions">
            <button
              className="tool-btn tool-btn--solid"
              type="button"
              onClick={save}
              disabled={status === "saving" || !dirty}
            >
              {status === "saving" ? "Saving…" : "Save changes"}
            </button>
            {status === "saved" && <span className="tool-sub-line" style={{ color: "#166534" }}>Saved ✓</span>}
            {status === "error" && <span className="tool-sub-line" style={{ color: "#8b0000" }}>Couldn&apos;t save.</span>}
          </div>

          <div className="crm-archive-row">
            <button className="tool-btn" type="button" onClick={toggleArchive}>
              {archived ? "Restore to roster" : "Move to archive"}
            </button>
            <span className="tool-sub-line">
              {archived ? "This person is parked in the archive." : "Parks the person out of the roster."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: string | null; href?: string | null }) {
  return (
    <div className="crm-dl-row">
      <dt>{label}</dt>
      <dd>
        {value ? (
          href ? (
            <a href={href} className="tool-link">{value}</a>
          ) : (
            value
          )
        ) : (
          <span style={{ opacity: 0.35 }}>—</span>
        )}
      </dd>
    </div>
  );
}
