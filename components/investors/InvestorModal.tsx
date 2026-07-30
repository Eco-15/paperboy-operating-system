"use client";

import { useEffect } from "react";
import type { Investor } from "@/lib/investors/types";
import { badgeClass, linkedinOf, norm } from "@/lib/investors/helpers";

export default function InvestorModal({
  row,
  onClose,
}: {
  row: Investor;
  onClose: () => void;
}) {
  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const w = norm(row.Website);
  const li = norm(linkedinOf(row));
  const loc = [row.City, row.State].filter(Boolean).join(", ");

  return (
    <div className="tool-modal-backdrop" onClick={onClose}>
      <div className="tool-modal" onClick={(e) => e.stopPropagation()}>
        <button className="tool-modal-close" type="button" onClick={onClose} aria-label="Close">
          &#x2715;
        </button>
        <h2>{row["Group Name"]}</h2>
        <div className="tool-modal-meta">
          <span className={badgeClass(row.Type)}>{row.Type}</span>
          {loc && <span style={{ marginLeft: 10 }}>{loc}</span>}
        </div>
        {(w || li) && (
          <div className="tool-modal-links">
            {w && (
              <a className="tool-link" href={w} target="_blank" rel="noopener noreferrer">
                Website
              </a>
            )}
            {li && (
              <a className="tool-link" href={li} target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            )}
          </div>
        )}
        <div className="tool-panel-title">About</div>
        <div className="tool-modal-summary">{row.Summary || "—"}</div>
      </div>
    </div>
  );
}
