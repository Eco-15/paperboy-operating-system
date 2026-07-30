"use client";

import { useCallback, useEffect, useState } from "react";
import { DOC_CATEGORIES, fmtBytes, fmtUsd } from "@/lib/portal/format";

// Staff console for the LP portal (/admin/investors): four tabs backed by
// app/api/admin/lp/*. Investors here are LPs (lp_profile), NOT the CPG
// investor research database at /investors.

interface Lp {
  id: string;
  email: string;
  entityName: string;
  contactName: string | null;
  commitmentUsd: number | null;
  investedUsd: number | null;
  status: string;
  notes: string | null;
  accountStatus: "active" | "invited" | "no-invite";
  acceptUrl: string | null;
}

interface Doc {
  id: string;
  title: string;
  category: string;
  filename: string | null;
  size: number | null;
  externalUrl: string | null;
  sharedWithAll: boolean;
  sharedWith: string[] | null;
  createdAt: string;
}

interface Update {
  id: string;
  title: string;
  body: string;
  status: string;
  publishedAt: string | null;
}

interface Company {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  highlight: string | null;
  website: string | null;
  logoUrl: string | null;
  status: string;
  investedOn: string | null;
  visible: boolean;
}

const TABS = [
  { key: "investors", label: "Investors" },
  { key: "documents", label: "Documents" },
  { key: "updates", label: "Updates" },
  { key: "portfolio", label: "Portfolio" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function InvestorRelations() {
  const [tab, setTab] = useState<TabKey>("investors");
  const [lps, setLps] = useState<Lp[]>([]);

  const loadLps = useCallback(async () => {
    const res = await fetch("/api/admin/lp/investors");
    if (res.ok) setLps((await res.json()).investors ?? []);
  }, []);
  useEffect(() => {
    loadLps();
  }, [loadLps]);

  return (
    <div className="tool-main">
      <div className="tool-head">
        <div>
          <div className="tool-title">Investor Relations</div>
          <div className="tool-sub">
            Run the LP portal — logins, documents, updates, and the portfolio LPs
            see at <a href="/portal">/portal</a>
          </div>
        </div>
        <a className="tool-btn" href="/portal">
          Preview portal
        </a>
      </div>

      <div className="tool-toolbar" style={{ gap: 6 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={"tool-btn" + (tab === t.key ? " tool-btn--solid" : "")}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "investors" && <InvestorsTab lps={lps} reload={loadLps} />}
      {tab === "documents" && <DocumentsTab lps={lps} />}
      {tab === "updates" && <UpdatesTab />}
      {tab === "portfolio" && <PortfolioTab />}
    </div>
  );
}

/* ── Investors ─────────────────────────────────────────────────────────────── */

function InvestorsTab({ lps, reload }: { lps: Lp[]; reload: () => void }) {
  const [entityName, setEntityName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [commitment, setCommitment] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addInvestor(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setLink(null);
    const res = await fetch("/api/admin/lp/investors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityName: entityName.trim(),
        contactName: contactName.trim() || undefined,
        email: email.trim(),
        commitmentUsd: commitment ? Number(commitment) : null,
      }),
    });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error ?? "Something went wrong.");
      return;
    }
    setLink(d.acceptUrl);
    setEntityName("");
    setContactName("");
    setEmail("");
    setCommitment("");
    reload();
  }

  async function reinvite(lp: Lp) {
    const res = await fetch(`/api/admin/lp/investors/${lp.id}`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setLink(d.acceptUrl);
      reload();
    }
  }

  async function patch(lp: Lp, fields: Record<string, unknown>) {
    await fetch(`/api/admin/lp/investors/${lp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    reload();
  }

  return (
    <>
      <div className="tool-panel" style={{ marginTop: 8 }}>
        <div className="tool-panel-title">Add an investor (LP)</div>
        <form onSubmit={addInvestor} className="tool-toolbar" style={{ flexWrap: "wrap" }}>
          <input
            className="tool-input"
            placeholder="Entity (e.g. Cohen Family Trust)"
            value={entityName}
            onChange={(e) => setEntityName(e.target.value)}
            required
          />
          <input
            className="tool-input"
            placeholder="Contact name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
          <input
            className="tool-input"
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="tool-input"
            type="number"
            min={0}
            placeholder="Commitment ($)"
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
            style={{ maxWidth: 160 }}
          />
          <button className="tool-btn tool-btn--solid" type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add + invite"}
          </button>
        </form>
        {error && <div className="tool-sub-line" style={{ color: "#b23b3b" }}>{error}</div>}
        {link && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input className="tool-input" readOnly value={link} style={{ flex: 1 }} />
            <button
              className="tool-btn"
              type="button"
              onClick={() => navigator.clipboard?.writeText(link)}
            >
              Copy invite link
            </button>
          </div>
        )}
      </div>

      <div className="tool-panel" style={{ marginTop: 8 }}>
        <div className="tool-panel-title">Investors</div>
        {lps.length === 0 ? (
          <div className="tool-sub-line">No investors yet — add your first LP above.</div>
        ) : (
          <ul className="poker-log">
            {lps.map((lp) => (
              <li className="poker-log-item" key={lp.id}>
                <div>
                  <div>
                    {lp.entityName}
                    {lp.status === "archived" && (
                      <span className="poker-log-meta"> · archived</span>
                    )}
                  </div>
                  <div className="poker-log-meta">
                    {[lp.contactName, lp.email].filter(Boolean).join(" · ")} ·{" "}
                    {fmtUsd(lp.commitmentUsd)} committed
                    {lp.investedUsd != null ? ` · ${fmtUsd(lp.investedUsd)} called` : ""}
                  </div>
                </div>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span className="poker-log-meta">
                    {lp.accountStatus === "active"
                      ? "account active"
                      : lp.accountStatus === "invited"
                        ? "invite pending"
                        : "not invited"}
                  </span>
                  {lp.accountStatus !== "active" && (
                    <button className="tool-btn" type="button" onClick={() => reinvite(lp)}>
                      {lp.accountStatus === "invited" ? "New link" : "Invite"}
                    </button>
                  )}
                  <button
                    className="tool-btn"
                    type="button"
                    onClick={() => {
                      const v = window.prompt(
                        `Commitment for ${lp.entityName} ($):`,
                        String(lp.commitmentUsd ?? ""),
                      );
                      if (v === null) return;
                      const c = window.prompt(
                        `Called to date for ${lp.entityName} ($):`,
                        String(lp.investedUsd ?? ""),
                      );
                      if (c === null) return;
                      patch(lp, {
                        commitmentUsd: v === "" ? null : Number(v),
                        investedUsd: c === "" ? null : Number(c),
                      });
                    }}
                  >
                    Amounts
                  </button>
                  <button
                    className="tool-btn"
                    type="button"
                    onClick={() =>
                      patch(lp, {
                        status: lp.status === "archived" ? "active" : "archived",
                      })
                    }
                  >
                    {lp.status === "archived" ? "Restore" : "Archive"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* ── Documents ─────────────────────────────────────────────────────────────── */

function DocumentsTab({ lps }: { lps: Lp[] }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("report");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [audience, setAudience] = useState<"all" | "select">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/lp/documents");
    if (res.ok) setDocs((await res.json()).documents ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("title", title.trim());
    form.set("category", category);
    form.set("sharedWithAll", String(audience === "all"));
    form.set("sharedWith", JSON.stringify(audience === "all" ? [] : selected));
    if (file) form.set("file", file);
    else form.set("externalUrl", externalUrl.trim());
    const res = await fetch("/api/admin/lp/documents", { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Upload failed.");
      return;
    }
    setTitle("");
    setExternalUrl("");
    setFile(null);
    setSelected([]);
    load();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this document for all investors?")) return;
    await fetch(`/api/admin/lp/documents/${id}`, { method: "DELETE" });
    load();
  }

  const lpName = (id: string) => lps.find((l) => l.id === id)?.entityName ?? "?";

  return (
    <>
      <div className="tool-panel" style={{ marginTop: 8 }}>
        <div className="tool-panel-title">Share a document</div>
        <form onSubmit={upload} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="tool-toolbar" style={{ flexWrap: "wrap" }}>
            <input
              className="tool-input"
              placeholder="Title (e.g. Q2 2026 LP Report)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ flex: 1, minWidth: 220 }}
            />
            <select
              className="tool-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {DOC_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="tool-toolbar" style={{ flexWrap: "wrap" }}>
            <input
              className="tool-input"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="tool-sub-line">or</span>
            <input
              className="tool-input"
              type="url"
              placeholder="https:// external link (Drive, DocSend…)"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
          </div>
          <div className="tool-toolbar" style={{ flexWrap: "wrap" }}>
            <select
              className="tool-select"
              value={audience}
              onChange={(e) => setAudience(e.target.value as "all" | "select")}
            >
              <option value="all">All investors</option>
              <option value="select">Specific investors…</option>
            </select>
            {audience === "select" && (
              <select
                className="tool-select"
                multiple
                value={selected}
                onChange={(e) =>
                  setSelected(Array.from(e.target.selectedOptions).map((o) => o.value))
                }
                style={{ minWidth: 240, minHeight: 90 }}
              >
                {lps
                  .filter((l) => l.status !== "archived")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.entityName}
                    </option>
                  ))}
              </select>
            )}
            <button className="tool-btn tool-btn--solid" type="submit" disabled={busy}>
              {busy ? "Sharing…" : "Share document"}
            </button>
          </div>
          <div className="tool-sub-line">
            Uploads up to 25 MB. Documents are only visible to the investors you pick —
            nothing is shared by default.
          </div>
          {error && <div className="tool-sub-line" style={{ color: "#b23b3b" }}>{error}</div>}
        </form>
      </div>

      <div className="tool-panel" style={{ marginTop: 8 }}>
        <div className="tool-panel-title">Shared documents</div>
        {docs.length === 0 ? (
          <div className="tool-sub-line">Nothing shared yet.</div>
        ) : (
          <ul className="poker-log">
            {docs.map((d) => (
              <li className="poker-log-item" key={d.id}>
                <div>
                  <div>{d.title}</div>
                  <div className="poker-log-meta">
                    {d.category}
                    {d.size ? ` · ${fmtBytes(d.size)}` : d.externalUrl ? " · link" : ""}
                    {" · "}
                    {d.sharedWithAll
                      ? "all investors"
                      : (d.sharedWith ?? []).length === 0
                        ? "not shared with anyone"
                        : (d.sharedWith ?? []).map(lpName).join(", ")}
                  </div>
                </div>
                <span style={{ display: "flex", gap: 6 }}>
                  <a className="tool-btn" href={`/api/portal/documents/${d.id}/download`}>
                    Open
                  </a>
                  <button className="tool-btn" type="button" onClick={() => remove(d.id)}>
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* ── Updates ───────────────────────────────────────────────────────────────── */

function UpdatesTab() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/lp/updates");
    if (res.ok) setUpdates((await res.json()).updates ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function create(publish: boolean) {
    if (!title.trim() || !body.trim() || busy) return;
    setBusy(true);
    const res = await fetch("/api/admin/lp/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), body, publish }),
    });
    setBusy(false);
    if (res.ok) {
      setTitle("");
      setBody("");
      load();
    }
  }

  async function setPublished(u: Update, publish: boolean) {
    await fetch(`/api/admin/lp/updates/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publish }),
    });
    load();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this update?")) return;
    await fetch(`/api/admin/lp/updates/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <div className="tool-panel" style={{ marginTop: 8 }}>
        <div className="tool-panel-title">Write an investor update</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            className="tool-input"
            placeholder="Title (e.g. Q2 2026 — Letter to LPs)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="tool-input"
            placeholder="The letter itself. Plain text — paragraphs are preserved as written."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
          <div className="tool-toolbar">
            <button
              className="tool-btn"
              type="button"
              disabled={busy}
              onClick={() => create(false)}
            >
              Save draft
            </button>
            <button
              className="tool-btn tool-btn--solid"
              type="button"
              disabled={busy}
              onClick={() => create(true)}
            >
              Publish to investors
            </button>
          </div>
        </div>
      </div>

      <div className="tool-panel" style={{ marginTop: 8 }}>
        <div className="tool-panel-title">All updates</div>
        {updates.length === 0 ? (
          <div className="tool-sub-line">No updates yet.</div>
        ) : (
          <ul className="poker-log">
            {updates.map((u) => (
              <li className="poker-log-item" key={u.id}>
                <div>
                  <div>{u.title}</div>
                  <div className="poker-log-meta">
                    {u.status === "published"
                      ? `published${u.publishedAt ? ` · ${new Date(u.publishedAt).toLocaleDateString()}` : ""}`
                      : "draft"}
                  </div>
                </div>
                <span style={{ display: "flex", gap: 6 }}>
                  <button
                    className="tool-btn"
                    type="button"
                    onClick={() => setPublished(u, u.status !== "published")}
                  >
                    {u.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  <button className="tool-btn" type="button" onClick={() => remove(u.id)}>
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* ── Portfolio ─────────────────────────────────────────────────────────────── */

function PortfolioTab() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [highlight, setHighlight] = useState("");
  const [website, setWebsite] = useState("");
  const [investedOn, setInvestedOn] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/lp/portfolio");
    if (res.ok) setCompanies((await res.json()).companies ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/admin/lp/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        highlight: highlight.trim() || undefined,
        website: website.trim() || undefined,
        investedOn: investedOn.trim() || undefined,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      setCategory("");
      setDescription("");
      setHighlight("");
      setWebsite("");
      setInvestedOn("");
      load();
    }
  }

  async function patch(c: Company, fields: Record<string, unknown>) {
    await fetch(`/api/admin/lp/portfolio/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    load();
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this company from the portal?")) return;
    await fetch(`/api/admin/lp/portfolio/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <div className="tool-panel" style={{ marginTop: 8 }}>
        <div className="tool-panel-title">Add a portfolio company</div>
        <form onSubmit={add} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="tool-toolbar" style={{ flexWrap: "wrap" }}>
            <input
              className="tool-input"
              placeholder="Company name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="tool-input"
              placeholder="Category (e.g. Beverage)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <input
              className="tool-input"
              placeholder="Invested (e.g. Q1 2026)"
              value={investedOn}
              onChange={(e) => setInvestedOn(e.target.value)}
              style={{ maxWidth: 160 }}
            />
          </div>
          <div className="tool-toolbar" style={{ flexWrap: "wrap" }}>
            <input
              className="tool-input"
              placeholder="One-line description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ flex: 1, minWidth: 240 }}
            />
            <input
              className="tool-input"
              placeholder="Highlight (e.g. 3× YoY growth)"
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
            />
            <input
              className="tool-input"
              type="url"
              placeholder="https://website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
            <button className="tool-btn tool-btn--solid" type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add company"}
            </button>
          </div>
          <div className="tool-sub-line">
            New companies are hidden until you make them visible to investors.
          </div>
        </form>
      </div>

      <div className="tool-panel" style={{ marginTop: 8 }}>
        <div className="tool-panel-title">Companies</div>
        {companies.length === 0 ? (
          <div className="tool-sub-line">No portfolio companies yet.</div>
        ) : (
          <ul className="poker-log">
            {companies.map((c) => (
              <li className="poker-log-item" key={c.id}>
                <div>
                  <div>{c.name}</div>
                  <div className="poker-log-meta">
                    {[c.category, c.investedOn, c.status].filter(Boolean).join(" · ")} ·{" "}
                    {c.visible ? "visible to investors" : "hidden"}
                  </div>
                </div>
                <span style={{ display: "flex", gap: 6 }}>
                  <button
                    className="tool-btn"
                    type="button"
                    onClick={() => patch(c, { visible: !c.visible })}
                  >
                    {c.visible ? "Hide" : "Show"}
                  </button>
                  <button
                    className="tool-btn"
                    type="button"
                    onClick={() =>
                      patch(c, { status: c.status === "exited" ? "active" : "exited" })
                    }
                  >
                    {c.status === "exited" ? "Mark active" : "Mark exited"}
                  </button>
                  <button className="tool-btn" type="button" onClick={() => remove(c.id)}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
