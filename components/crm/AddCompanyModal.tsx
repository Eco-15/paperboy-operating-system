"use client";

import { useEffect, useState } from "react";
import type { Deal } from "@/lib/crm/types";
import { ASSIGNABLE_STAGES, FUNDS } from "@/lib/crm/stages";

// Add a company to the pipeline. POSTs to /api/crm (inserts into brand_app) and
// hands the created Deal back to the parent so it appears immediately.
export default function AddCompanyModal({
  onAdd,
  onClose,
}: {
  onAdd: (deal: Deal) => void;
  onClose: () => void;
}) {
  const [company, setCompany] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [stage, setStage] = useState("New");
  const [priority, setPriority] = useState("");
  const [fund, setFund] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (!company.trim()) {
      setError("Company name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          category: category.trim() || undefined,
          subcategory: subcategory.trim() || undefined,
          stage,
          priority: priority || undefined,
          fund: fund || undefined,
          contactName: contactName.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          website: website.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError(res.status === 400 ? "Please check the fields and try again." : "Couldn't add the company.");
        setBusy(false);
        return;
      }
      const { deal } = (await res.json()) as { deal: Deal };
      onAdd(deal);
      onClose();
    } catch {
      setError("Couldn't add the company.");
      setBusy(false);
    }
  }

  return (
    <div className="tool-modal-backdrop" onClick={onClose}>
      <div className="tool-modal" onClick={(e) => e.stopPropagation()}>
        <button className="tool-modal-close" type="button" onClick={onClose} aria-label="Close">
          &#x2715;
        </button>
        <h2>Add Company</h2>
        <div className="tool-modal-meta">New deal in the pipeline</div>

        <div className="tool-field">
          <label>Company *</label>
          <input
            className="tool-input"
            type="text"
            placeholder="Company name"
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
            <label>Category</label>
            <input className="tool-input" type="text" placeholder="e.g. Skincare" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="tool-field">
            <label>Subcategory</label>
            <input className="tool-input" type="text" placeholder="Optional" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} />
          </div>
        </div>

        <div className="crm-form-row">
          <div className="tool-field">
            <label>Stage</label>
            <select className="tool-select" value={stage} onChange={(e) => setStage(e.target.value)}>
              {ASSIGNABLE_STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="tool-field">
            <label>Priority</label>
            <select className="tool-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">—</option>
              {[6, 5, 4, 3, 2, 1].map((p) => (
                <option key={p} value={String(p)}>P{p}{p === 6 ? " (top)" : ""}</option>
              ))}
            </select>
          </div>
          <div className="tool-field">
            <label>Fund</label>
            <select className="tool-select" value={fund} onChange={(e) => setFund(e.target.value)}>
              <option value="">Unassigned</option>
              {FUNDS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="crm-form-row">
          <div className="tool-field">
            <label>Contact Name</label>
            <input className="tool-input" type="text" placeholder="Optional" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div className="tool-field">
            <label>Contact Email</label>
            <input className="tool-input" type="email" placeholder="Optional" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
        </div>

        <div className="tool-field">
          <label>Website</label>
          <input className="tool-input" type="text" placeholder="https://…" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        <div className="tool-field">
          <label>Notes</label>
          <textarea className="tool-input" rows={3} placeholder="Optional" value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        {error && <div className="tool-sub-line" style={{ color: "#8b0000" }}>{error}</div>}

        <div className="tool-modal-actions">
          <button className="tool-btn" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="tool-btn tool-btn--solid" type="button" onClick={submit} disabled={busy}>
            {busy ? "Adding…" : "Add Company"}
          </button>
        </div>
      </div>
    </div>
  );
}
