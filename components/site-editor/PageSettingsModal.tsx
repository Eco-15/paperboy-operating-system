"use client";

// Per-page settings, Wix-style: the newspaper chrome (section label + kicker
// shown in the Sheet folio) and SEO (browser-tab title + meta description).
// Applies as one undoable commit.

import { useState } from "react";
import type { SitePageContent, SitePageSlug } from "@/lib/site-content/schema";
import { SHEET_DEFAULTS } from "@/lib/site-content/defaults";

type AnyContent = SitePageContent[SitePageSlug];

export default function PageSettingsModal({
  slug,
  content,
  onApply,
  onClose,
}: {
  slug: SitePageSlug;
  content: AnyContent;
  onApply: (patch: {
    sheet: { section: string; kicker: string };
    seo?: { title?: string; description?: string };
  }) => void;
  onClose: () => void;
}) {
  const sheet = content.sheet ?? SHEET_DEFAULTS[slug];
  const [section, setSection] = useState(sheet.section);
  const [kicker, setKicker] = useState(sheet.kicker);
  const [seoTitle, setSeoTitle] = useState(content.seo?.title ?? "");
  const [seoDescription, setSeoDescription] = useState(
    content.seo?.description ?? "",
  );

  function apply() {
    const seo = {
      title: seoTitle.trim() || undefined,
      description: seoDescription.trim() || undefined,
    };
    onApply({
      sheet: {
        section: section.trim() || SHEET_DEFAULTS[slug].section,
        kicker: kicker.trim() || SHEET_DEFAULTS[slug].kicker,
      },
      seo: seo.title || seo.description ? seo : undefined,
    });
  }

  return (
    <div className="tool-modal-backdrop" onClick={onClose}>
      <div className="tool-modal se-settings" onClick={(e) => e.stopPropagation()}>
        <button className="tool-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="tool-modal-meta">Page settings</div>

        <div className="se-settings-grid">
          <label className="se-pop-field">
            <span>Section label (top folio line)</span>
            <input
              className="tool-input"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
          </label>
          <label className="se-pop-field">
            <span>Kicker (line under the wordmark)</span>
            <input
              className="tool-input"
              value={kicker}
              onChange={(e) => setKicker(e.target.value)}
            />
          </label>
          <label className="se-pop-field">
            <span>SEO title (browser tab &amp; Google) — {seoTitle.length}/60</span>
            <input
              className="tool-input"
              placeholder="Uses the built-in title when empty"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
            />
          </label>
          <label className="se-pop-field">
            <span>SEO description — {seoDescription.length}/160</span>
            <textarea
              className="tool-input"
              rows={3}
              placeholder="Uses the built-in description when empty"
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
            />
          </label>
        </div>

        <div className="tool-modal-actions">
          <button type="button" className="tool-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="tool-btn tool-btn--solid" onClick={apply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
