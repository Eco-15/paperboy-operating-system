"use client";

import { useEffect, useState } from "react";
import type { TalentRec } from "@/lib/talent/types";
import { ASSIGNABLE_STAGES } from "@/lib/talent/stages";

// Add a person to the roster. POSTs to /api/talent and hands the created
// record back to the parent so it appears immediately.
export default function AddTalentModal({
  onAdd,
  onClose,
}: {
  onAdd: (person: TalentRec) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [stage, setStage] = useState("New");
  const [priority, setPriority] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
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
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/talent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role: role.trim() || undefined,
          company: company.trim() || undefined,
          stage,
          priority: priority || undefined,
          email: email.trim() || undefined,
          link: link.trim() || undefined,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError(res.status === 400 ? "Please check the fields and try again." : "Couldn't add the person.");
        setBusy(false);
        return;
      }
      const { person } = (await res.json()) as { person: TalentRec };
      onAdd(person);
      onClose();
    } catch {
      setError("Couldn't add the person.");
      setBusy(false);
    }
  }

  return (
    <div className="tool-modal-backdrop" onClick={onClose}>
      <div className="tool-modal" onClick={(e) => e.stopPropagation()}>
        <button className="tool-modal-close" type="button" onClick={onClose} aria-label="Close">
          &#x2715;
        </button>
        <h2>Add Person</h2>
        <div className="tool-modal-meta">New person on the talent roster</div>

        <div className="tool-field">
          <label>Name *</label>
          <input
            className="tool-input"
            type="text"
            placeholder="Full name"
            value={name}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />
        </div>

        <div className="crm-form-row">
          <div className="tool-field">
            <label>Role</label>
            <input className="tool-input" type="text" placeholder="e.g. Growth Marketing" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div className="tool-field">
            <label>Company</label>
            <input className="tool-input" type="text" placeholder="Current employer" value={company} onChange={(e) => setCompany(e.target.value)} />
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
            <label>Location</label>
            <input className="tool-input" type="text" placeholder="Optional" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>

        <div className="crm-form-row">
          <div className="tool-field">
            <label>Email</label>
            <input className="tool-input" type="email" placeholder="Optional" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="tool-field">
            <label>LinkedIn / Portfolio</label>
            <input className="tool-input" type="text" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} />
          </div>
        </div>

        <div className="tool-field">
          <label>Notes</label>
          <textarea className="tool-input" rows={3} placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <div className="tool-sub-line" style={{ color: "#8b0000" }}>{error}</div>}

        <div className="tool-modal-actions">
          <button className="tool-btn" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="tool-btn tool-btn--solid" type="button" onClick={submit} disabled={busy}>
            {busy ? "Adding…" : "Add Person"}
          </button>
        </div>
      </div>
    </div>
  );
}
