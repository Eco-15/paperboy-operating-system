"use client";

import { useState } from "react";
import Link from "next/link";
import { fmtShortDate, relativeTime } from "@/lib/crm/format";
import type { Deal } from "@/lib/crm/types";

// "Here's what came in since you last looked." The whole point of opening the
// CRM in the morning: inbound responses that arrived after this user's
// watermark, newest first, with one click to clear them.
//
// `newIds` is computed server-side against the per-user watermark (see
// lib/crm/seen.ts) — the client never decides what's new, it just renders it.

const PREVIEW = 6;

/** A one-line label for where the response came from. */
function originLabel(d: Deal): string {
  if (d.origin === "form") {
    const t = d.formType;
    if (t === "founder") return "Founder application";
    if (t === "investor") return "Investor enquiry";
    if (t === "contact") return "Contact form";
    return "Website form";
  }
  return d.source || "Brand application";
}

function excerpt(v: string | null, max = 120): string {
  if (!v) return "";
  const flat = v.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export default function NewResponses({
  deals,
  newIds,
  newSince,
  onAcknowledge,
}: {
  deals: Deal[];
  newIds: string[];
  newSince: string | null;
  /** Clears the tray and moves the watermark. */
  onAcknowledge: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const byId = new Map(deals.map((d) => [d.id, d]));
  const items = newIds.map((id) => byId.get(id)).filter((d): d is Deal => !!d);
  const since = newSince ? fmtShortDate(newSince) : null;

  // Nothing new — stay a quiet single line rather than an empty box. On a
  // first-ever visit there's no watermark to report, so say nothing at all.
  if (items.length === 0) {
    if (!since) return null;
    return (
      <p className="crm-new-quiet">
        No new responses since {since}. You&rsquo;re all caught up.
      </p>
    );
  }

  const shown = expanded ? items : items.slice(0, PREVIEW);
  const hidden = items.length - shown.length;

  return (
    <section className="crm-new" aria-label="New responses">
      <header className="crm-new-head">
        <span className="crm-new-count">{items.length}</span>
        <h2 className="crm-new-title">
          new {items.length === 1 ? "response" : "responses"}
          {since ? <span className="crm-new-since"> since {since}</span> : null}
        </h2>
        <button type="button" className="crm-new-ack" onClick={onAcknowledge}>
          Mark all caught up
        </button>
      </header>

      <ul className="crm-new-list">
        {shown.map((d) => (
          <li key={d.id}>
            <Link href={`/crm/${d.id}`} className="crm-new-row">
              <span className="crm-new-co">{d.company}</span>
              <span className="crm-new-kind">{originLabel(d)}</span>
              {d.message ? (
                <span className="crm-new-msg">{excerpt(d.message)}</span>
              ) : d.contactEmail ? (
                <span className="crm-new-msg">{d.contactEmail}</span>
              ) : (
                <span className="crm-new-msg" />
              )}
              <span className="crm-new-when">{relativeTime(d.arrivedAt ?? d.date)}</span>
            </Link>
          </li>
        ))}
      </ul>

      {hidden > 0 ? (
        <button type="button" className="crm-new-more" onClick={() => setExpanded(true)}>
          Show {hidden} more
        </button>
      ) : null}
    </section>
  );
}
