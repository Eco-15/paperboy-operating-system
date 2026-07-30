"use client";

import { useEffect, useState } from "react";
import PanelSkeleton from "./PanelSkeleton";

type Mail = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
};

// "unavailable" = the gmail endpoint isn't live yet (Phase 3 not deployed);
// "disconnected" = live but this user hasn't linked Google.
type Mode = "loading" | "unavailable" | "disconnected" | "connected";

function fmtDate(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// The signed-in user's own unread mail, from /api/dashboard/gmail (reads THIS
// user's connected Google account). Per-account: no connection → Connect CTA.
export default function EmailPanel() {
  const [mode, setMode] = useState<Mode>("loading");
  const [messages, setMessages] = useState<Mail[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/gmail")
      .then(async (r) => {
        if (r.status === 404) return { mode: "unavailable" as Mode };
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        return {
          mode: (d.connected ? "connected" : "disconnected") as Mode,
          messages: (d.messages ?? []) as Mail[],
        };
      })
      .then((res) => {
        if (!active) return;
        setMode(res.mode);
        if (res.messages) setMessages(res.messages);
      })
      .catch(() => active && setMode("unavailable"));
    return () => {
      active = false;
    };
  }, []);

  async function disconnect() {
    await fetch("/api/google/disconnect", { method: "POST" }).catch(() => {});
    window.location.reload();
  }

  return (
    <section className="dash-panel">
      <div className="dash-panel-head">
        <span className="dash-panel-title">Inbox — Unread</span>
        {mode === "connected" && (
          <button type="button" className="dash-panel-action" onClick={disconnect}>
            Disconnect
          </button>
        )}
      </div>

      {mode === "loading" && <PanelSkeleton />}
      {mode === "unavailable" && <div className="dash-empty">Inbox sync coming soon.</div>}

      {mode === "disconnected" && (
        <div className="dash-connect">
          <p className="dash-connect-text">Connect your Google account to see your inbox.</p>
          <a className="dash-connect-btn" href="/api/google/connect">Connect Google</a>
        </div>
      )}

      {mode === "connected" && messages.length === 0 && (
        <div className="dash-empty">Inbox zero — nothing unread.</div>
      )}

      {mode === "connected" && messages.length > 0 && (
        <div className="dash-list">
          {messages.map((m) => (
            <div className="dash-row" key={m.id}>
              <div className="dash-row-main">
                <div className="dash-row-title">
                  {m.from}
                  <span className="dash-row-date">{fmtDate(m.date)}</span>
                </div>
                <div className="dash-row-sub">{m.subject || m.snippet}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
