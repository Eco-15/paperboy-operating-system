"use client";

import { useEffect, useState } from "react";
import type { SponsorRec, SponsorTier } from "@/lib/events/types";
import { TIER_AMOUNT, TIER_LABEL } from "@/lib/events/types";

// Standard package per tier — pre-fills the checklist, editable before saving.
const TIER_DELIVERABLES: Record<SponsorTier, string[]> = {
  title: [
    "Naming rights — presented by",
    "10 guaranteed intros",
    "Logo on all signage + carts",
    "Speaking moment at dinner",
    "Gift bag placement",
    "Recap deck logo",
    "8 guest passes",
  ],
  secondary: [
    "5 guaranteed intros",
    "Logo on signage",
    "Gift bag placement",
    "Recap deck logo",
    "4 guest passes",
  ],
  exhibition: ["Table at the turn", "Gift bag placement", "2 guest passes"],
};

// Add a sponsor slot. POSTs to /api/events/[id]/sponsors and hands the created
// record back so it appears in its tier immediately.
export default function AddSponsorModal({
  eventId,
  onAdd,
  onClose,
}: {
  eventId: string;
  onAdd: (sponsor: SponsorRec) => void;
  onClose: () => void;
}) {
  const [company, setCompany] = useState("");
  const [tier, setTier] = useState<SponsorTier>("secondary");
  const [amount, setAmount] = useState(String(TIER_AMOUNT.secondary ?? ""));
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [deliverables, setDeliverables] = useState(TIER_DELIVERABLES.secondary.join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pickTier(next: SponsorTier) {
    setTier(next);
    setAmount(TIER_AMOUNT[next] != null ? String(TIER_AMOUNT[next]) : "");
    setDeliverables(TIER_DELIVERABLES[next].join("\n"));
  }

  async function submit() {
    if (!company.trim()) {
      setError("Company is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}/sponsors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          tier,
          amount: amount.trim() ? Number(amount) : null,
          contactName: contactName.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          deliverables: deliverables
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .map((label) => ({ label, done: false })),
        }),
      });
      if (!res.ok) {
        setError("Couldn't add the sponsor.");
        setBusy(false);
        return;
      }
      const { sponsor } = (await res.json()) as { sponsor: SponsorRec };
      onAdd(sponsor);
      onClose();
    } catch {
      setError("Couldn't add the sponsor.");
      setBusy(false);
    }
  }

  return (
    <div className="tool-modal-backdrop" onClick={onClose}>
      <div className="tool-modal" onClick={(e) => e.stopPropagation()}>
        <button className="tool-modal-close" type="button" onClick={onClose} aria-label="Close">
          &#x2715;
        </button>
        <h2>Add Sponsor</h2>
        <div className="tool-modal-meta">Slot, contact, and the deliverables we owe them</div>

        <div className="tool-field">
          <label>Company *</label>
          <input
            className="tool-input"
            type="text"
            placeholder="Sponsor company"
            value={company}
            autoFocus
            onChange={(e) => {
              setCompany(e.target.value);
              setError("");
            }}
          />
        </div>

        <div className="crm-form-row">
          <div className="tool-field">
            <label>Tier</label>
            <select
              className="tool-select"
              value={tier}
              onChange={(e) => pickTier(e.target.value as SponsorTier)}
            >
              {(Object.keys(TIER_LABEL) as SponsorTier[]).map((t) => (
                <option key={t} value={t}>
                  {TIER_LABEL[t]}
                  {TIER_AMOUNT[t] != null ? ` — $${TIER_AMOUNT[t]!.toLocaleString()}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="tool-field">
            <label>Amount ($)</label>
            <input
              className="tool-input"
              type="number"
              min={0}
              step={1000}
              placeholder="8000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="crm-form-row">
          <div className="tool-field">
            <label>Contact name</label>
            <input
              className="tool-input"
              type="text"
              placeholder="Optional"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
          <div className="tool-field">
            <label>Contact email</label>
            <input
              className="tool-input"
              type="email"
              placeholder="Optional"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="tool-field">
          <label>Deliverables (one per line)</label>
          <textarea
            className="tool-input"
            rows={6}
            value={deliverables}
            onChange={(e) => setDeliverables(e.target.value)}
          />
        </div>

        {error && <div className="tool-sub-line" style={{ color: "#8b0000" }}>{error}</div>}

        <div className="tool-modal-actions">
          <button className="tool-btn" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="tool-btn tool-btn--solid" type="button" onClick={submit} disabled={busy}>
            {busy ? "Adding…" : "Add Sponsor"}
          </button>
        </div>
      </div>
    </div>
  );
}
