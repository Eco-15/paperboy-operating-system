"use client";

import { useState } from "react";
import type { Deliverable, SponsorRec, SponsorTier } from "@/lib/events/types";
import { formatAmount, SPONSOR_TIERS, TIER_AMOUNT, TIER_LABEL } from "@/lib/events/types";
import AddSponsorModal from "./AddSponsorModal";
import s from "./events.module.css";

// Sponsor slots grouped by tier, each with its deliverables checklist — the
// stuff that used to live buried in PDF agreements. Tapping a line toggles it
// done and the progress bar moves.
export default function Sponsors({
  eventId,
  sponsors,
  onAdd,
  onPatch,
}: {
  eventId: string;
  sponsors: SponsorRec[];
  onAdd: (sponsor: SponsorRec) => void;
  onPatch: (id: string, patch: { deliverables: Deliverable[] }) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);

  function toggle(sp: SponsorRec, idx: number) {
    const deliverables = sp.deliverables.map((d, i) =>
      i === idx ? { ...d, done: !d.done } : d,
    );
    onPatch(sp.id, { deliverables });
  }

  const untiered = sponsors.filter((sp) => !sp.tier);

  return (
    <div>
      <div className="tool-toolbar" style={{ flexWrap: "wrap", margin: "0 0 1rem" }}>
        <span className="tool-count">
          {sponsors.length} {sponsors.length === 1 ? "sponsor" : "sponsors"}
        </span>
        <div style={{ marginLeft: "auto" }}>
          <button className="tool-btn tool-btn--solid" type="button" onClick={() => setShowAdd(true)}>
            + Add sponsor
          </button>
        </div>
      </div>

      {sponsors.length === 0 ? (
        <div className={s.empty}>
          <p>No sponsors yet — the golf party carries a $20K title slot and three $8K secondary slots.</p>
          <button className="tool-btn tool-btn--solid" type="button" onClick={() => setShowAdd(true)}>
            + Add the first sponsor
          </button>
        </div>
      ) : (
        <>
          {SPONSOR_TIERS.map((tier) => {
            const inTier = sponsors.filter((sp) => sp.tier === tier);
            if (inTier.length === 0) return null;
            return (
              <div key={tier}>
                <div className={s.tierHead}>
                  <span className={s.tierName}>{TIER_LABEL[tier]}</span>
                  <span className={s.tierPrice}>
                    {TIER_AMOUNT[tier] != null ? formatAmount(TIER_AMOUNT[tier]) : "custom"}
                  </span>
                </div>
                <div className={s.sponsorGrid}>
                  {inTier.map((sp) => (
                    <SponsorCard key={sp.id} sponsor={sp} onToggle={(i) => toggle(sp, i)} />
                  ))}
                </div>
              </div>
            );
          })}
          {untiered.length > 0 && (
            <div>
              <div className={s.tierHead}>
                <span className={s.tierName}>Other</span>
              </div>
              <div className={s.sponsorGrid}>
                {untiered.map((sp) => (
                  <SponsorCard key={sp.id} sponsor={sp} onToggle={(i) => toggle(sp, i)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showAdd && (
        <AddSponsorModal
          eventId={eventId}
          onAdd={(sp) => onAdd(sp)}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function SponsorCard({
  sponsor,
  onToggle,
}: {
  sponsor: SponsorRec;
  onToggle: (index: number) => void;
}) {
  const total = sponsor.deliverables.length;
  const done = sponsor.deliverables.filter((d) => d.done).length;

  return (
    <div className={s.sponsorCard}>
      <div className={s.sponsorTop}>
        <span className={s.sponsorName}>{sponsor.company}</span>
        <span className={s.sponsorAmt}>{formatAmount(sponsor.amount)}</span>
      </div>
      {(sponsor.contactName || sponsor.contactEmail) && (
        <div className={s.sponsorContact}>
          {sponsor.contactName}
          {sponsor.contactName && sponsor.contactEmail ? " · " : ""}
          {sponsor.contactEmail ? (
            <a href={`mailto:${sponsor.contactEmail}`} className="tool-link">
              {sponsor.contactEmail}
            </a>
          ) : null}
        </div>
      )}

      {total > 0 ? (
        <>
          <div className={s.dlProgress}>
            Deliverables — {done} of {total} done
          </div>
          <div className={s.dlBar}>
            <div className={s.dlBarFill} style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          {sponsor.deliverables.map((d, i) => (
            <button key={i} type="button" className={s.dlItem} onClick={() => onToggle(i)}>
              <span className={`${s.dlBox}${d.done ? ` ${s.dlBoxDone}` : ""}`}>✓</span>
              <span className={d.done ? s.dlLabelDone : undefined}>{d.label}</span>
            </button>
          ))}
        </>
      ) : (
        <div className={s.dlProgress}>No deliverables — slot is open.</div>
      )}
    </div>
  );
}
