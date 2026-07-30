"use client";

import { useEffect, useState } from "react";

interface Invite {
  id: string;
  email: string;
  role: string;
  token: string;
  acceptedAt: string | null;
  expiresAt: string;
}

export default function InviteManager() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("client");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/invites");
    if (res.ok) setInvites((await res.json()).invites ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      setLink(d.acceptUrl);
      setEmail("");
      load();
    }
  }

  return (
    <div className="tool-main">
      <div className="tool-head">
        <div>
          <div className="tool-title">Invitations</div>
          <div className="tool-sub">Invite clients and staff to Paperboy OS</div>
        </div>
      </div>

      <form onSubmit={create} className="tool-toolbar" style={{ flexWrap: "wrap" }}>
        <input
          className="tool-input"
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select className="tool-select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="client">Client</option>
          <option value="internal">Internal (staff)</option>
          <option value="investor">Investor (LP portal)</option>
        </select>
        <button className="tool-btn tool-btn--solid" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create invite"}
        </button>
      </form>

      {link && (
        <div className="tool-panel" style={{ marginTop: 8 }}>
          <div className="tool-panel-title">Invite link (send this to them)</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="tool-input" readOnly value={link} style={{ flex: 1 }} />
            <button
              className="tool-btn"
              type="button"
              onClick={() => navigator.clipboard?.writeText(link)}
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="tool-panel" style={{ marginTop: 8 }}>
        <div className="tool-panel-title">Sent invites</div>
        {invites.length === 0 ? (
          <div className="tool-sub-line">No invites yet.</div>
        ) : (
          <ul className="poker-log">
            {invites.map((i) => (
              <li className="poker-log-item" key={i.id}>
                <div>
                  <div>{i.email}</div>
                  <div className="poker-log-meta">{i.role}</div>
                </div>
                <span className="poker-log-meta">
                  {i.acceptedAt ? "accepted" : "pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
