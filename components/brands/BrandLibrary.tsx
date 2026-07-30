"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { downloadCsv } from "@/lib/export/csv";
import MarkdownLite from "@/components/MarkdownLite";

// The Brand Library: knowledge cards from the Drive brain, enriched (by the
// API) with CRM facts — category, website, deck, priority. All styling lives
// in .brand-* classes (globals.css) on the design tokens, so it matches the
// console and works in dark mode.

type Brand = {
  id: string;
  name: string;
  updatedAt: string | null;
  category: string | null;
  subcategory: string | null;
  website: string | null;
  deckLink: string | null;
  priority: number | null;
  stage: string | null;
  dealId: string | null;
};
type Detail = Brand & { title: string; body: string };

const cleanName = (s: string) => s.replace(/\s*[—-]\s*Brand Card\s*$/i, "").trim();

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function initials(name: string): string {
  const words = cleanName(name).split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

function siteHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Real brand logo pulled from the company's own site (via Google's favicon
// service — no scraping needed); brands without a website (or whose logo 404s)
// fall back to the bronze monogram.
function BrandAvatar({ name, website, large }: { name: string; website: string | null; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const host = siteHost(website);
  const cls = `brand-avatar${large ? " brand-avatar--lg" : ""}`;
  if (!host || failed) return <span className={cls}>{initials(name)}</span>;
  return (
    <span className={`${cls} brand-avatar--img`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`}
        alt={cleanName(name)}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

export default function BrandLibrary() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<"cards" | "table">("table");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/brands")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => alive && setBrands(d.brands ?? []))
      .catch(() => alive && setError("Couldn't load the brand library."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Close the drawer on Escape.
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detail]);

  const categories = useMemo(
    () => [...new Set(brands.map((b) => b.category).filter(Boolean))].sort() as string[],
    [brands],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return brands.filter((b) => {
      if (category !== "all" && b.category !== category) return false;
      if (q && !cleanName(b.name).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [brands, query, category]);

  async function openBrand(b: Brand) {
    setDetail({ ...b, title: cleanName(b.name), body: "" });
    setDetailLoading(true);
    try {
      const r = await fetch(`/api/brands?id=${encodeURIComponent(b.id)}`);
      const d = await r.json();
      if (d.brand) setDetail({ ...b, ...d.brand, title: cleanName(d.brand.title) });
    } catch {
      /* leave the header; body stays empty */
    } finally {
      setDetailLoading(false);
    }
  }

  if (loading) return <p style={{ opacity: 0.6 }}>Loading brands…</p>;
  if (error) return <p style={{ opacity: 0.7 }}>{error}</p>;

  const detailSite = detail && detail.website ? (/^https?:\/\//.test(detail.website) ? detail.website : `https://${detail.website}`) : null;

  return (
    <div>
      <div className="tool-toolbar" style={{ flexWrap: "wrap", margin: "0 0 1rem" }}>
        <input
          className="tool-input"
          type="search"
          placeholder="Search brands…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: "1 1 240px", maxWidth: 340 }}
        />
        <span className="tool-count">{filtered.length} brands</span>
        <div style={{ display: "flex", gap: "0.4rem", marginLeft: "auto" }}>
          <select className="tool-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            className="tool-btn"
            type="button"
            onClick={() =>
              downloadCsv(
                `brands-${filtered.length}.csv`,
                filtered.map((b) => ({
                  Brand: cleanName(b.name),
                  Category: b.category ?? "",
                  Website: b.website ?? "",
                  Priority: b.priority ?? "",
                  Updated: fmtDate(b.updatedAt),
                })),
                ["Brand", "Category", "Website", "Priority", "Updated"],
              )
            }
            disabled={filtered.length === 0}
            title="Download the brand list as CSV"
          >
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* view tabs — same pattern as the CRM's Board/Table */}
      <div className="crm-tabs">
        <button type="button" className={`crm-tab${view === "table" ? " crm-tab--active" : ""}`} onClick={() => setView("table")}>
          Table
        </button>
        <button type="button" className={`crm-tab${view === "cards" ? " crm-tab--active" : ""}`} onClick={() => setView("cards")}>
          Cards
        </button>
      </div>

      {filtered.length === 0 ? (
        <p style={{ opacity: 0.6 }}>No brands match{query ? ` “${query}”` : ""}.</p>
      ) : view === "table" ? (
        <div className="tool-table-wrap">
          <table className="tool-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Category</th>
                <th>Website</th>
                <th>Pri</th>
                <th>Stage</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="clickable" onClick={() => openBrand(b)}>
                  <td>
                    <span className="brand-row-id">
                      <BrandAvatar name={b.name} website={b.website} />
                      <span style={{ fontWeight: 600 }}>{cleanName(b.name)}</span>
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {b.category || <span style={{ opacity: 0.35 }}>—</span>}
                    {b.subcategory ? <span style={{ opacity: 0.5 }}> · {b.subcategory}</span> : null}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                    {siteHost(b.website) ? (
                      <a
                        className="tool-link"
                        href={/^https?:\/\//.test(b.website!) ? b.website! : `https://${b.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {siteHost(b.website)}&nbsp;↗
                      </a>
                    ) : (
                      <span style={{ opacity: 0.35 }}>—</span>
                    )}
                  </td>
                  <td>
                    {b.priority != null ? (
                      <span className={`crm-pri${b.priority >= 5 ? " crm-pri--high" : ""}`}>P{b.priority}</span>
                    ) : (
                      <span style={{ opacity: 0.35 }}>—</span>
                    )}
                  </td>
                  <td>
                    {b.stage ? (
                      <span className="brand-chip">{b.stage}</span>
                    ) : (
                      <span style={{ opacity: 0.35 }}>—</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap", opacity: 0.7 }}>{fmtDate(b.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="brand-grid">
          {filtered.map((b) => (
            <button key={b.id} type="button" className="brand-card" onClick={() => openBrand(b)}>
              <div className="brand-card-top">
                <BrandAvatar name={b.name} website={b.website} />
                <span className="brand-card-id">
                  <span className="brand-card-name">{cleanName(b.name)}</span>
                  {siteHost(b.website) && <span className="brand-card-site">{siteHost(b.website)}</span>}
                </span>
                {b.priority != null && b.priority >= 5 && (
                  <span className="crm-pri crm-pri--high">P{b.priority}</span>
                )}
              </div>
              <div className="brand-card-foot">
                {b.category ? (
                  <span className="brand-chip">
                    {b.category}
                    {b.subcategory ? ` · ${b.subcategory}` : ""}
                  </span>
                ) : (
                  <span />
                )}
                {b.updatedAt && <span className="brand-card-date">{fmtDate(b.updatedAt)}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <>
          <div className="brand-overlay" onClick={() => setDetail(null)} />
          <aside className="brand-drawer" role="dialog" aria-label={detail.title}>
            <div className="brand-drawer-head">
              <BrandAvatar name={detail.title} website={detail.website} large />
              <div className="brand-drawer-id">
                <strong className="brand-drawer-title">{detail.title}</strong>
                <span className="brand-drawer-meta">
                  {[detail.category, detail.subcategory].filter(Boolean).join(" · ") || "Brand card"}
                </span>
              </div>
              <button className="brand-drawer-close" onClick={() => setDetail(null)} aria-label="Close">
                ×
              </button>
            </div>

            {(detailSite || detail.deckLink || detail.dealId) && (
              <div className="brand-drawer-links">
                {detailSite && (
                  <a className="tool-btn" href={detailSite} target="_blank" rel="noopener noreferrer">
                    Website ↗
                  </a>
                )}
                {detail.deckLink && /^https?:\/\//.test(detail.deckLink) && (
                  <a className="tool-btn" href={detail.deckLink} target="_blank" rel="noopener noreferrer">
                    Pitch deck ↗
                  </a>
                )}
                {detail.dealId && (
                  <Link className="tool-btn" href={`/crm/${detail.dealId}`}>
                    Open in CRM →
                  </Link>
                )}
              </div>
            )}

            <div className="brand-drawer-body">
              {detailLoading && !detail.body ? (
                <p style={{ opacity: 0.6 }}>Loading…</p>
              ) : detail.body ? (
                <MarkdownLite md={detail.body} />
              ) : (
                <p style={{ opacity: 0.6 }}>No content for this brand yet.</p>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
