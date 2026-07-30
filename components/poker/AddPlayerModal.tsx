"use client";

import { useEffect, useState } from "react";

export default function AddPlayerModal({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, company: string) => boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") submit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, company]);

  function submit() {
    if (!name.trim()) return;
    if (!company.trim()) return;
    const ok = onAdd(name.trim(), company.trim());
    if (!ok) {
      setError("That player already exists.");
      return;
    }
    onClose();
  }

  return (
    <div className="tool-modal-backdrop" onClick={onClose}>
      <div className="tool-modal" onClick={(e) => e.stopPropagation()}>
        <button className="tool-modal-close" type="button" onClick={onClose} aria-label="Close">
          &#x2715;
        </button>
        <h2>Add Player</h2>
        <div className="tool-modal-meta">New tournament entry</div>

        <div className="tool-field">
          <label>Player Name</label>
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
        <div className="tool-field">
          <label>Company</label>
          <input
            className="tool-input"
            type="text"
            placeholder="Company or fund"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
        {error && <div className="tool-sub-line" style={{ color: "#8b0000" }}>{error}</div>}

        <div className="tool-modal-actions">
          <button className="tool-btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="tool-btn tool-btn--solid" type="button" onClick={submit}>
            Add Player
          </button>
        </div>
      </div>
    </div>
  );
}
