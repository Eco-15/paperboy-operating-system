"use client";

import { useMemo, useState } from "react";
import type { RsvpRec } from "@/lib/events/types";
import s from "./events.module.css";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// The door screen. Built for a phone at the course: sticky counter + big
// search, whole rows are the tap target, one tap checks in, tapping again
// undoes it. Only approved guests (incl. players) count toward the total.
export default function CheckIn({
  rsvps,
  onToggle,
}: {
  rsvps: RsvpRec[];
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const eligible = useMemo(
    () =>
      rsvps
        .filter((r) => r.status === "approved" || r.status === "approved_player")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rsvps],
  );

  const checkedIn = eligible.filter((r) => r.checkedInAt).length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? eligible.filter((r) =>
          `${r.name} ${r.company ?? ""} ${r.email}`.toLowerCase().includes(q),
        )
      : eligible;
    // Still-outside guests first — they're who the door is looking for.
    return [...base].sort((a, b) => {
      if (!!a.checkedInAt !== !!b.checkedInAt) return a.checkedInAt ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [eligible, query]);

  if (eligible.length === 0) {
    return (
      <div className={s.empty}>
        <p>No approved guests yet — approve people on the Guest List tab and they show up here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className={s.ciHead}>
        <div className={s.ciCounter}>
          <span className={s.ciCount}>
            {checkedIn} / {eligible.length}
          </span>
          <span className={s.ciLabel}>checked in</span>
        </div>
        <div className={s.ciBar}>
          <div
            className={s.ciBarFill}
            style={{ width: `${eligible.length ? (checkedIn / eligible.length) * 100 : 0}%` }}
          />
        </div>
        <input
          className={s.ciSearch}
          type="search"
          placeholder="Find a guest…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      {shown.length === 0 ? (
        <p style={{ opacity: 0.6 }}>Nobody matches “{query}”.</p>
      ) : (
        <div className={s.ciList}>
          {shown.map((r) => {
            const done = !!r.checkedInAt;
            return (
              <button
                key={r.id}
                type="button"
                className={`${s.ciRow}${done ? ` ${s.ciRowDone}` : ""}`}
                onClick={() => onToggle(r.id)}
              >
                <span className={`${s.ciMark}${done ? ` ${s.ciMarkDone}` : ""}`}>✓</span>
                <span className={s.ciInfo}>
                  <span className={s.ciName}>{r.name}</span>
                  <span className={s.ciMeta}>
                    {r.company || r.email}
                    {r.status === "approved_player" ? " · player" : ""}
                  </span>
                </span>
                {done && r.checkedInAt && (
                  <span className={s.ciTime}>
                    {timeOf(r.checkedInAt)} · tap to undo
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
