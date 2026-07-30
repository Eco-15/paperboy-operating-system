"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Deal } from "@/lib/crm/types";
import { ALL_STATUSES, ARCHIVE_STATUSES, ASSIGNABLE_STAGES, FUNDS, stageColor, stageKey } from "@/lib/crm/stages";
import MarkdownLite from "@/components/MarkdownLite";

function fmtDate(v: string | null): string {
  if (!v) return "";
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) return v;
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function extUrl(v: string | null): string | null {
  if (!v) return null;
  // CSV link fields are sometimes "Filename.pdf (https://…)" — pull the URL.
  const m = v.match(/https?:\/\/[^\s)]+/);
  if (m) return m[0];
  return /^https?:\/\//.test(v) ? v : null;
}

function host(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// Hosts that mean "this is an actual document", not the company homepage.
const DOC_HOSTS =
  /docsend|dropbox|drive\.google|docs\.google|notion\.s[oi]|box\.com|pitch\.com|canva\.com|figma\.com|slideshare|loom\.com/i;

// A deck link is only presented as a pitch deck when it plausibly IS one:
// a .pdf, a known doc host, or a different host than the company website.
// Everything else was the CSV pointing back at the company site — label it
// honestly as the website instead of a deck.
function isRealDeck(deckUrl: string, websiteUrl: string | null): boolean {
  if (/\.pdf(\?|#|$)/i.test(deckUrl)) return true;
  if (DOC_HOSTS.test(deckUrl)) return true;
  const d = host(deckUrl);
  const w = websiteUrl ? host(websiteUrl) : null;
  return !!d && !!w && d !== w;
}

export interface BrandCard {
  id: string;
  title: string;
  body: string;
}

export default function CrmDealDetail({ deal, brandCard }: { deal: Deal; brandCard?: BrandCard | null }) {
  const router = useRouter();
  const isApp = deal.origin === "app";
  const [brandOpen, setBrandOpen] = useState(false);
  const [stage, setStage] = useState(stageKey(deal));
  const [priority, setPriority] = useState(deal.priority != null ? String(deal.priority) : "");
  const [fund, setFund] = useState(deal.fund ?? "");
  const [notes, setNotes] = useState(deal.message ?? "");
  const [archived, setArchived] = useState(deal.archived);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const site = extUrl(deal.website);
  const deckUrl = extUrl(deal.deckLink);
  const deckIsReal = deckUrl ? isRealDeck(deckUrl, site) : false;
  // The one-pager column held either a URL or (usually) the memo text itself.
  const onePagerUrl = deal.onePager && extUrl(deal.onePager);
  const onePagerText =
    deal.onePager && !onePagerUrl && deal.onePager.trim().length > 0 ? deal.onePager : null;

  const dirty =
    stage !== stageKey(deal) ||
    fund !== (deal.fund ?? "") ||
    (isApp && priority !== (deal.priority != null ? String(deal.priority) : "")) ||
    notes !== (deal.message ?? "");

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/crm/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: deal.origin, ...body }),
    });
    if (!res.ok) throw new Error(String(res.status));
  }

  async function save() {
    setStatus("saving");
    const body: Record<string, unknown> = { stage, message: notes, fund: fund || null };
    if (isApp) body.priority = priority ? Number(priority) : null;
    try {
      await patch(body);
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
            {deal.company}
            {deal.origin === "form" && stageKey(deal) === "New" && <span className="crm-badge-new">NEW</span>}
            {archived && <span className="crm-archived-tag">Archived</span>}
          </div>
          <div className="tool-sub">
            {deal.category || "Uncategorized"}
            {deal.subcategory ? ` · ${deal.subcategory}` : ""}
            {deal.source ? ` · via ${deal.source}` : ""}
            {deal.date ? ` · ${fmtDate(deal.date)}` : ""}
          </div>
        </div>
        <div className="crm-detail-head-tags">
          {deal.fund && <span className="crm-fund-chip">{deal.fund}</span>}
          {deal.priority != null && (
            <span className={`crm-pri${deal.priority >= 5 ? " crm-pri--high" : ""}`}>P{deal.priority}</span>
          )}
          <span className="crm-stage-tag" style={{ background: stageColor(stage) }}>{stage}</span>
        </div>
      </div>

      <div className="crm-detail-grid">
        {/* Left: the deal itself — materials + memo + contact */}
        <div className="crm-detail-main">
          <div className="tool-panel">
            <div className="tool-panel-title">Materials</div>
            <div className="crm-materials">
              {deckUrl && deckIsReal && (
                <a href={deckUrl} target="_blank" rel="noopener noreferrer" className="crm-material">
                  <span className="crm-material-icon">▤</span>
                  <span>
                    <span className="crm-material-name">Pitch deck</span>
                    <span className="crm-material-meta">{host(deckUrl)}</span>
                  </span>
                </a>
              )}
              {site && (
                <a href={site} target="_blank" rel="noopener noreferrer" className="crm-material">
                  <span className="crm-material-icon">⌂</span>
                  <span>
                    <span className="crm-material-name">Website</span>
                    <span className="crm-material-meta">{host(site)}</span>
                  </span>
                </a>
              )}
              {/* Deck links that just point at the company site are shown as the website, not a deck. */}
              {deckUrl && !deckIsReal && !site && (
                <a href={deckUrl} target="_blank" rel="noopener noreferrer" className="crm-material">
                  <span className="crm-material-icon">⌂</span>
                  <span>
                    <span className="crm-material-name">Website</span>
                    <span className="crm-material-meta">{host(deckUrl)}</span>
                  </span>
                </a>
              )}
              {onePagerUrl && (
                <a href={onePagerUrl} target="_blank" rel="noopener noreferrer" className="crm-material">
                  <span className="crm-material-icon">≡</span>
                  <span>
                    <span className="crm-material-name">One-pager</span>
                    <span className="crm-material-meta">{host(onePagerUrl)}</span>
                  </span>
                </a>
              )}
              {!deckUrl && !site && !onePagerUrl && !onePagerText && (
                <span className="tool-sub-line">No materials on file.</span>
              )}
            </div>
          </div>

          {onePagerText && (
            <div className="tool-panel">
              <div className="tool-panel-title">Investment memo</div>
              <div className="crm-memo">
                <MarkdownLite md={onePagerText} skipH1={false} />
              </div>
            </div>
          )}

          {/* The Brand Library, folded in: the brand's knowledge card lives on
              its deal page now instead of a separate tab. */}
          {brandCard && (
            <div className="tool-panel">
              <div className="tool-panel-title">Brand file</div>
              <div className={`crm-memo crm-brandfile${brandOpen ? "" : " crm-brandfile--clamped"}`}>
                <MarkdownLite md={brandCard.body} skipH1 />
              </div>
              <button className="tool-btn crm-brandfile-toggle" type="button" onClick={() => setBrandOpen((v) => !v)}>
                {brandOpen ? "Show less" : "Read the full brand file"}
              </button>
            </div>
          )}

          <div className="tool-panel">
            <div className="tool-panel-title">Contact</div>
            <dl className="crm-dl">
              <Row label="Name" value={deal.contactName} />
              <Row
                label="Email"
                value={deal.contactEmail}
                href={deal.contactEmail ? `mailto:${deal.contactEmail}` : null}
              />
              {deal.formType && <Row label="Form" value={deal.formType} />}
              <Row label="Source" value={deal.source} />
            </dl>
          </div>
        </div>

        {/* Right: editable pipeline fields */}
        <div className="tool-panel crm-detail-side">
          <div className="tool-panel-title">Pipeline</div>

          <div className="tool-field">
            <label>Fund</label>
            <select
              className="tool-select"
              value={fund}
              onChange={(e) => {
                setFund(e.target.value);
                setStatus("idle");
              }}
            >
              <option value="">Unassigned</option>
              {FUNDS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

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

          {isApp && (
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
          )}

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
              {archived ? "Restore to pipeline" : "Move to archive"}
            </button>
            <span className="tool-sub-line">
              {archived ? "This deal is parked in the archive." : "Parks the deal out of the pipeline."}
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
