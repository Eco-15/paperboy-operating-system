"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  NlOverview,
  NlSubscriber,
  NlPost,
  NlSegment,
  NlCustomField,
  NlAutomation,
} from "@/lib/newsletter/types";

type Tab = "overview" | "subscribers" | "posts" | "compose" | "segments";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "subscribers", label: "Subscribers" },
  { key: "posts", label: "Posts" },
  { key: "compose", label: "Compose" },
  { key: "segments", label: "Segments" },
];

type ApiResult<T> = { ok: boolean; status: number; body: T | null };

async function api<T = unknown>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(`/api/newsletter/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let body: T | null = null;
  try {
    body = (await res.json()) as T;
  } catch {
    /* no body */
  }
  return { ok: res.ok, status: res.status, body };
}

function pct(v?: number): string {
  if (v == null) return "—";
  // Beehiiv rates may be 0-1 or 0-100; normalize.
  const n = v <= 1 ? v * 100 : v;
  return `${n.toFixed(1)}%`;
}

function NotConfigured() {
  return (
    <div className="nl-panel">
      <div className="nl-panel-title">Connect Beehiiv</div>
      <p>
        This module talks to your Beehiiv account. Add these to your environment
        (Beehiiv → Settings → API), then restart:
      </p>
      <pre className="nl-code">
        BEEHIIV_API_KEY=…{"\n"}BEEHIIV_PUBLICATION_ID=pub_…
      </pre>
      <p className="nl-muted">
        The key is read server-side only. Until it&apos;s set, this stays a
        placeholder.
      </p>
    </div>
  );
}

function useTabData<T>(path: string | null) {
  const [state, setState] = useState<{ loading: boolean; data: T | null; notConfigured: boolean; error?: string }>({
    loading: !!path,
    data: null,
    notConfigured: false,
  });
  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    const r = await api<T>(path);
    if (r.status === 503) setState({ loading: false, data: null, notConfigured: true });
    else if (!r.ok) setState({ loading: false, data: null, notConfigured: false, error: "Couldn’t reach Beehiiv." });
    else setState({ loading: false, data: r.body, notConfigured: false });
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

// ── Overview ────────────────────────────────────────────────────────────────
function OverviewTab() {
  const { loading, data, notConfigured } = useTabData<NlOverview>("overview");
  if (notConfigured) return <NotConfigured />;
  if (loading) return <div className="nl-muted">Loading…</div>;
  if (!data) return <div className="nl-muted">No data.</div>;
  const p = data.publication;
  return (
    <div>
      <div className="nl-stats">
        <div className="nl-stat">
          <div className="nl-stat-n">{p.activeSubscribers.toLocaleString()}</div>
          <div className="nl-stat-l">Active subscribers</div>
        </div>
        <div className="nl-stat">
          <div className="nl-stat-n">{pct(p.averageOpenRate)}</div>
          <div className="nl-stat-l">Avg. open rate</div>
        </div>
        <div className="nl-stat">
          <div className="nl-stat-n">{p.totalSent != null ? p.totalSent.toLocaleString() : "—"}</div>
          <div className="nl-stat-l">Emails sent</div>
        </div>
      </div>
      <div className="nl-section-label">Recent posts</div>
      <PostList posts={data.recentPosts} />
      {!data.sendEnabled && (
        <p className="nl-muted nl-note">
          Note: API sending is off (<code>BEEHIIV_SEND_ENABLED=false</code> or plan-gated). Compose creates drafts.
        </p>
      )}
    </div>
  );
}

function PostList({ posts }: { posts: NlPost[] }) {
  if (!posts.length) return <div className="nl-muted">No posts yet.</div>;
  return (
    <table className="nl-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Date</th>
          <th>Recipients</th>
          <th>Open</th>
          <th>Click</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {posts.map((p) => (
          <tr key={p.id}>
            <td>{p.title}</td>
            <td>{p.date}</td>
            <td>{p.recipients?.toLocaleString() ?? "—"}</td>
            <td>{pct(p.openRate)}</td>
            <td>{pct(p.clickRate)}</td>
            <td>{p.webUrl ? <a href={p.webUrl} target="_blank" rel="noopener noreferrer">view →</a> : null}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Subscribers ───────────────────────────────────────────────────────────────
function SubscribersTab() {
  const [query, setQuery] = useState("");
  const [path, setPath] = useState("subscribers");
  const { loading, data, notConfigured, reload } = useTabData<{ subscribers: NlSubscriber[]; total: number }>(path);
  const [addEmail, setAddEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  if (notConfigured) return <NotConfigured />;

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setPath(query.trim() ? `subscribers?email=${encodeURIComponent(query.trim())}` : "subscribers");
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const r = await api<{ subscriber?: NlSubscriber; detail?: unknown }>("subscribers", {
      method: "POST",
      body: JSON.stringify({ email: addEmail.trim() }),
    });
    if (r.ok) {
      setMsg(`Added ${addEmail.trim()}.`);
      setAddEmail("");
      reload();
    } else {
      setMsg("Couldn’t add that email (already subscribed, or a Beehiiv error).");
    }
  }

  return (
    <div>
      <div className="nl-toolbar">
        <form onSubmit={search} className="nl-inline">
          <input className="nl-input" placeholder="Search by email" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="nl-btn" type="submit">Search</button>
        </form>
        <form onSubmit={add} className="nl-inline">
          <input className="nl-input" type="email" placeholder="Add subscriber email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} required />
          <button className="nl-btn nl-btn--solid" type="submit">Add</button>
        </form>
      </div>
      {msg && <div className="nl-msg">{msg}</div>}
      {loading ? (
        <div className="nl-muted">Loading…</div>
      ) : (
        <>
          <div className="nl-muted nl-note">{data?.total?.toLocaleString() ?? 0} total</div>
          <table className="nl-table">
            <thead>
              <tr><th>Email</th><th>Status</th><th>Joined</th><th>Source</th></tr>
            </thead>
            <tbody>
              {(data?.subscribers ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{s.email}</td>
                  <td><span className="nl-badge">{s.status}</span></td>
                  <td>{s.created}</td>
                  <td>{s.utmSource ?? "—"}</td>
                </tr>
              ))}
              {!data?.subscribers?.length && <tr><td colSpan={4} className="nl-muted">No subscribers found.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ── Posts ─────────────────────────────────────────────────────────────────────
function PostsTab() {
  const { loading, data, notConfigured } = useTabData<{ posts: NlPost[] }>("posts");
  if (notConfigured) return <NotConfigured />;
  if (loading) return <div className="nl-muted">Loading…</div>;
  return <PostList posts={data?.posts ?? []} />;
}

// ── Compose ───────────────────────────────────────────────────────────────────
function ComposeTab() {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "gate"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await api<{ post?: NlPost; error?: string; upstreamStatus?: number }>("posts", {
      method: "POST",
      body: JSON.stringify({ action: "create", title, subtitle: subtitle || undefined, bodyHtml }),
    });
    setBusy(false);
    if (r.ok) setMsg({ kind: "ok", text: "Draft created in Beehiiv." });
    else if (r.status === 503) setMsg({ kind: "gate", text: "Beehiiv isn’t connected yet." });
    else if (r.body?.upstreamStatus === 402 || r.body?.upstreamStatus === 403)
      setMsg({ kind: "gate", text: "Creating/sending posts via API needs the Send API (Enterprise/beta). Compose in Beehiiv and it’ll show up here." });
    else setMsg({ kind: "err", text: "Beehiiv rejected the draft. Check the fields, or compose in Beehiiv." });
  }

  return (
    <form onSubmit={save} className="nl-compose">
      <label className="nl-field">Title
        <input className="nl-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="nl-field">Subtitle
        <input className="nl-input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
      </label>
      <label className="nl-field">Body (HTML)
        <textarea className="nl-input" rows={10} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} required />
      </label>
      <div className="nl-inline">
        <button className="nl-btn nl-btn--solid" type="submit" disabled={busy}>{busy ? "Saving…" : "Save draft to Beehiiv"}</button>
      </div>
      {msg && <div className={`nl-msg nl-msg--${msg.kind}`}>{msg.text}</div>}
    </form>
  );
}

// ── Segments / fields / automations ───────────────────────────────────────────
function SegmentsTab() {
  const { loading, data, notConfigured } = useTabData<{ segments: NlSegment[]; customFields: NlCustomField[]; automations: NlAutomation[] }>("segments");
  if (notConfigured) return <NotConfigured />;
  if (loading) return <div className="nl-muted">Loading…</div>;
  return (
    <div className="nl-cols3">
      <div>
        <div className="nl-section-label">Segments</div>
        {(data?.segments ?? []).map((s) => (
          <div key={s.id} className="nl-row"><span>{s.name}</span><span className="nl-muted">{s.members?.toLocaleString() ?? "—"}</span></div>
        ))}
        {!data?.segments?.length && <div className="nl-muted">None.</div>}
      </div>
      <div>
        <div className="nl-section-label">Custom fields</div>
        {(data?.customFields ?? []).map((f) => (
          <div key={f.id} className="nl-row"><span>{f.name}</span><span className="nl-muted">{f.kind}</span></div>
        ))}
        {!data?.customFields?.length && <div className="nl-muted">None.</div>}
      </div>
      <div>
        <div className="nl-section-label">Automations</div>
        {(data?.automations ?? []).map((a) => (
          <div key={a.id} className="nl-row"><span>{a.name}</span><span className="nl-muted">{a.status ?? ""}</span></div>
        ))}
        {!data?.automations?.length && <div className="nl-muted">None.</div>}
      </div>
    </div>
  );
}

export default function NewsletterApp() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div className="nl-app">
      <div className="nl-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`nl-tab${tab === t.key ? " is-active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="nl-body">
        {tab === "overview" && <OverviewTab />}
        {tab === "subscribers" && <SubscribersTab />}
        {tab === "posts" && <PostsTab />}
        {tab === "compose" && <ComposeTab />}
        {tab === "segments" && <SegmentsTab />}
      </div>
    </div>
  );
}
