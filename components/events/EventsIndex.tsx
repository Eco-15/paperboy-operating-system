"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EventListItem } from "@/lib/events/types";
import NewEventModal from "./NewEventModal";
import s from "./events.module.css";

function fmtDate(date: string | null): string {
  if (!date) return "Date TBA";
  const t = new Date(date);
  if (Number.isNaN(t.getTime())) return "Date TBA";
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Events index: one card per event with its RSVP funnel. Cards link into the
// per-event console.
export default function EventsIndex() {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/events")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => alive && setEvents(d.events ?? []))
      .catch(() => alive && setError("Couldn't load events."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <p style={{ opacity: 0.6 }}>Loading events…</p>;
  if (error) return <p style={{ opacity: 0.7 }}>{error}</p>;

  return (
    <div>
      <div className="tool-toolbar" style={{ margin: "0 0 1rem" }}>
        <span className="tool-count">
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
        <div style={{ marginLeft: "auto" }}>
          <button className="tool-btn tool-btn--solid" type="button" onClick={() => setShowNew(true)}>
            + New Event
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className={s.empty}>
          <p>No events yet.</p>
          <button className="tool-btn tool-btn--solid" type="button" onClick={() => setShowNew(true)}>
            Create the first one
          </button>
        </div>
      ) : (
        <div className={s.grid}>
          {events.map((ev) => (
            <Link key={ev.id} href={`/events/manage/${ev.id}`} className={s.card}>
              <div className={s.cardTop}>
                <div>
                  <div className={s.cardName}>{ev.name}</div>
                  <div className={s.cardMeta}>
                    {fmtDate(ev.date)}
                    {ev.venue ? ` · ${ev.venue}` : ""}
                    {ev.format ? ` · ${ev.format}` : ""}
                  </div>
                </div>
                <span
                  className={`${s.statusChip} ${
                    ev.status === "live" ? s.statusChipLive : ev.status === "complete" ? s.statusChipComplete : ""
                  }`}
                >
                  {ev.status}
                </span>
              </div>
              <div className={s.funnel}>
                <Funnel v={ev.counts.pending} l="Pending" />
                <Funnel v={ev.counts.approved} l="Approved" />
                <Funnel v={ev.counts.players} l="Players" />
                <Funnel v={ev.counts.waitlist} l="Waitlist" />
                <Funnel v={ev.counts.checkedIn} l="Checked in" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {showNew && (
        <NewEventModal
          onCreate={(ev) =>
            setEvents((es) => [
              {
                ...ev,
                counts: { total: 0, pending: 0, approved: 0, players: 0, waitlist: 0, declined: 0, checkedIn: 0 },
              },
              ...es,
            ])
          }
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function Funnel({ v, l }: { v: number; l: string }) {
  return (
    <div className={s.funnelCell}>
      <div className={s.funnelV}>{v}</div>
      <div className={s.funnelL}>{l}</div>
    </div>
  );
}
