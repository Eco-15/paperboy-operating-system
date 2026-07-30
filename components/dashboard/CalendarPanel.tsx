"use client";

import { useEffect, useState } from "react";
import PanelSkeleton from "./PanelSkeleton";

type CalEvent = {
  id: string;
  title: string;
  start: string; // ISO or date
  allDay: boolean;
  location?: string | null;
};

// "unavailable" = the calendar endpoint isn't live yet (Phase 3 not deployed);
// "disconnected" = endpoint is live but this user hasn't linked Google.
type Mode = "loading" | "unavailable" | "disconnected" | "connected";

function isToday(start: string): boolean {
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return false;
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function fmtTime(start: string, allDay: boolean): string {
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return "";
  if (allDay) return "All day";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function fmtDay(start: string): string {
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// The signed-in user's own calendar — front and center. Today's events lead;
// anything further out shows under "Coming up." Reads /api/dashboard/calendar
// (THIS user's connected Google account); if unlinked, shows a Connect CTA.
export default function CalendarPanel() {
  const [mode, setMode] = useState<Mode>("loading");
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [today, setToday] = useState("");

  // Compute the date client-side to avoid a server/client timezone mismatch.
  useEffect(() => {
    setToday(new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/calendar")
      .then(async (r) => {
        if (r.status === 404) return { mode: "unavailable" as Mode };
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        return {
          mode: (d.connected ? "connected" : "disconnected") as Mode,
          events: (d.events ?? []) as CalEvent[],
        };
      })
      .then((res) => {
        if (!active) return;
        setMode(res.mode);
        if (res.events) setEvents(res.events);
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

  const todays = events.filter((e) => isToday(e.start));
  const upcoming = events.filter((e) => !isToday(e.start));

  return (
    <section className="dash-panel dash-cal">
      <div className="dash-panel-head">
        <span className="dash-panel-title">Today</span>
        {mode === "connected" && (
          <button type="button" className="dash-panel-action" onClick={disconnect}>
            Disconnect
          </button>
        )}
      </div>

      {mode !== "disconnected" && (
        <div className="dash-cal-hero">
          <div className="dash-cal-date">{today || " "}</div>
          <div className="dash-cal-say">Here&apos;s what&apos;s going on today.</div>
        </div>
      )}

      {mode === "loading" && <PanelSkeleton rows={4} />}
      {mode === "unavailable" && <div className="dash-empty">Calendar sync coming soon.</div>}

      {mode === "disconnected" && (
        <div className="dash-connect">
          <p className="dash-connect-text">Connect your Google account to see your calendar right here.</p>
          <a className="dash-connect-btn" href="/api/google/connect">Connect Google</a>
        </div>
      )}

      {mode === "connected" && (
        <div className="dash-cal-body">
          {todays.length === 0 ? (
            <div className="dash-cal-clear">Nothing scheduled today — clear runway. ☕</div>
          ) : (
            <div className="dash-cal-list">
              {todays.map((e) => (
                <div className="dash-cal-row" key={e.id}>
                  <div className="dash-cal-time">{fmtTime(e.start, e.allDay)}</div>
                  <div className="dash-cal-main">
                    <div className="dash-cal-title">{e.title}</div>
                    {e.location && <div className="dash-cal-loc">{e.location}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="dash-cal-up">
              <div className="dash-cal-up-label">Coming up</div>
              {upcoming.slice(0, 5).map((e) => (
                <div className="dash-cal-row dash-cal-row--up" key={e.id}>
                  <div className="dash-cal-time">{fmtDay(e.start)}</div>
                  <div className="dash-cal-main">
                    <div className="dash-cal-title">{e.title}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
