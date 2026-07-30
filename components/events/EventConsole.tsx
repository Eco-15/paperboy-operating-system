"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Deliverable,
  EventDetail,
  EventRec,
  PairingRec,
  RsvpRec,
  RsvpStatus,
  ScoreRec,
  SponsorRec,
} from "@/lib/events/types";
import GuestList from "./GuestList";
import CheckIn from "./CheckIn";
import Pairings from "./Pairings";
import Scorecard from "./Scorecard";
import Sponsors from "./Sponsors";
import s from "./events.module.css";

type Tab = "guests" | "checkin" | "pairings" | "scorecard" | "sponsors";

const TABS: { key: Tab; label: string }[] = [
  { key: "guests", label: "Guest List" },
  { key: "checkin", label: "Check-In" },
  { key: "pairings", label: "Pairings" },
  { key: "scorecard", label: "Scorecard" },
  { key: "sponsors", label: "Sponsors" },
];

function fmtDate(date: string | null): string {
  if (!date) return "Date TBA";
  const t = new Date(date);
  if (Number.isNaN(t.getTime())) return "Date TBA";
  return t.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// The per-event console. Owns all event data + mutations; the five tabs are
// pure views over this state. Every write is optimistic with revert-on-error.
export default function EventConsole({ initialEvent }: { initialEvent: EventRec }) {
  const [event, setEvent] = useState<EventRec>(initialEvent);
  const [rsvps, setRsvps] = useState<RsvpRec[]>([]);
  const [pairings, setPairings] = useState<PairingRec[]>([]);
  const [scores, setScores] = useState<ScoreRec[]>([]);
  const [sponsors, setSponsors] = useState<SponsorRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("guests");

  useEffect(() => {
    let alive = true;
    fetch(`/api/events/${initialEvent.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: EventDetail) => {
        if (!alive) return;
        setEvent(d.event);
        setRsvps(d.rsvps);
        setPairings(d.pairings);
        setScores(d.scores);
        setSponsors(d.sponsors);
      })
      .catch(() => alive && setError("Couldn't load the event."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [initialEvent.id]);

  // ── RSVP status / pairing ──
  const patchRsvp = useCallback(
    async (id: string, patch: { status?: RsvpStatus; pairingId?: string | null }) => {
      const prev = rsvps;
      setRsvps((rs) =>
        rs.map((r) => {
          if (r.id !== id) return r;
          const next = { ...r, ...patch };
          // Mirror the server rule: only approved players hold a foursome slot.
          if (patch.status && patch.status !== "approved_player") next.pairingId = null;
          return next;
        }),
      );
      try {
        const res = await fetch(`/api/events/rsvp/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setRsvps(prev);
      }
    },
    [rsvps],
  );

  // ── Check-in toggle ──
  const toggleCheckin = useCallback(
    async (id: string) => {
      const prev = rsvps;
      setRsvps((rs) =>
        rs.map((r) =>
          r.id === id
            ? { ...r, checkedInAt: r.checkedInAt ? null : new Date().toISOString() }
            : r,
        ),
      );
      try {
        const res = await fetch(`/api/events/rsvp/${id}/checkin`, { method: "POST" });
        if (!res.ok) throw new Error(String(res.status));
        const { rsvp } = (await res.json()) as { rsvp: RsvpRec };
        setRsvps((rs) => rs.map((r) => (r.id === id ? rsvp : r)));
      } catch {
        setRsvps(prev);
      }
    },
    [rsvps],
  );

  // ── Pairings ──
  const addPairing = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${event.id}/pairings`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const { pairing } = (await res.json()) as { pairing: PairingRec };
      setPairings((ps) => [...ps, pairing]);
    } catch {
      /* leave state as-is; the button stays pressable */
    }
  }, [event.id]);

  const setTeeTime = useCallback(async (id: string, teeTime: string) => {
    setPairings((ps) => ps.map((p) => (p.id === id ? { ...p, teeTime: teeTime || null } : p)));
    try {
      await fetch(`/api/events/pairings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teeTime: teeTime || null }),
      });
    } catch {
      /* tee time is cosmetic; the next load reconciles */
    }
  }, []);

  const removePairing = useCallback(
    async (id: string) => {
      const prevP = pairings;
      const prevR = rsvps;
      const prevS = scores;
      setPairings((ps) => ps.filter((p) => p.id !== id));
      setRsvps((rs) => rs.map((r) => (r.pairingId === id ? { ...r, pairingId: null } : r)));
      setScores((ss) => ss.filter((sc) => sc.pairingId !== id));
      try {
        const res = await fetch(`/api/events/pairings/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setPairings(prevP);
        setRsvps(prevR);
        setScores(prevS);
      }
    },
    [pairings, rsvps, scores],
  );

  // ── Scores (debounced per pairing+hole so rapid stepper taps coalesce) ──
  const scoreTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const setScore = useCallback(
    (pairingId: string, hole: number, strokes: number | null) => {
      setScores((ss) => {
        const rest = ss.filter((sc) => !(sc.pairingId === pairingId && sc.hole === hole));
        if (strokes === null) return rest;
        const existing = ss.find((sc) => sc.pairingId === pairingId && sc.hole === hole);
        return [
          ...rest,
          existing
            ? { ...existing, strokes }
            : { id: `local-${pairingId}-${hole}`, pairingId, hole, strokes },
        ];
      });
      const key = `${pairingId}:${hole}`;
      const timers = scoreTimers.current;
      const pending = timers.get(key);
      if (pending) clearTimeout(pending);
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          fetch(`/api/events/${event.id}/scores`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pairingId, hole, strokes }),
          })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
            .then((d: { score?: ScoreRec }) => {
              if (!d.score) return;
              const saved = d.score;
              setScores((ss) =>
                ss.map((sc) =>
                  sc.pairingId === pairingId && sc.hole === hole ? saved : sc,
                ),
              );
            })
            .catch(() => {
              /* keep the optimistic value; a reload reconciles */
            });
        }, 350),
      );
    },
    [event.id],
  );

  // ── Sponsors ──
  const addSponsor = useCallback((sponsor: SponsorRec) => {
    setSponsors((sp) => [...sp, sponsor]);
  }, []);

  const patchSponsor = useCallback(
    async (id: string, patch: { deliverables?: Deliverable[]; amount?: number | null }) => {
      const prev = sponsors;
      setSponsors((sp) => sp.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      try {
        const res = await fetch(`/api/events/sponsors/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setSponsors(prev);
      }
    },
    [sponsors],
  );

  if (error) return <p style={{ opacity: 0.7 }}>{error}</p>;

  return (
    <div>
      <div className={s.consoleHead}>
        <div>
          <div className="tool-title">{event.name}</div>
          <div className="tool-sub">
            {fmtDate(event.date)}
            {event.venue ? ` · ${event.venue}` : ""} · {rsvps.length}{" "}
            {rsvps.length === 1 ? "RSVP" : "RSVPs"}
          </div>
        </div>
        <a
          className={s.publicLink}
          href={`/events/${event.slug}`}
          target="_blank"
          rel="noreferrer"
        >
          Public page ↗
        </a>
      </div>

      <div className="crm-tabs" style={{ overflowX: "auto" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`crm-tab${tab === t.key ? " crm-tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ opacity: 0.6 }}>Loading…</p>
      ) : tab === "guests" ? (
        <GuestList rsvps={rsvps} onPatch={patchRsvp} />
      ) : tab === "checkin" ? (
        <CheckIn rsvps={rsvps} onToggle={toggleCheckin} />
      ) : tab === "pairings" ? (
        <Pairings
          rsvps={rsvps}
          pairings={pairings}
          onAssign={(rsvpId, pairingId) => patchRsvp(rsvpId, { pairingId })}
          onAddPairing={addPairing}
          onSetTeeTime={setTeeTime}
          onRemovePairing={removePairing}
        />
      ) : tab === "scorecard" ? (
        <Scorecard rsvps={rsvps} pairings={pairings} scores={scores} onSetScore={setScore} />
      ) : (
        <Sponsors
          eventId={event.id}
          sponsors={sponsors}
          onAdd={addSponsor}
          onPatch={patchSponsor}
        />
      )}
    </div>
  );
}
