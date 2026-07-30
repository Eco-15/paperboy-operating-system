"use client";

import { useMemo, useState } from "react";
import type { RsvpRec, RsvpStatus } from "@/lib/events/types";
import { RSVP_STATUSES, STATUS_COLOR, STATUS_LABEL } from "@/lib/events/types";
import s from "./events.module.css";

const ACTIONS: { status: RsvpStatus; label: string }[] = [
  { status: "approved", label: "Approve" },
  { status: "approved_player", label: "Approve as Player" },
  { status: "waitlist", label: "Waitlist" },
  { status: "declined", label: "Decline" },
];

// The approval queue. Card rows (not a table) so the same layout works on a
// phone: search + status chips up top, one-tap status actions per guest,
// message on expand.
export default function GuestList({
  rsvps,
  onPatch,
}: {
  rsvps: RsvpRec[];
  onPatch: (id: string, patch: { status: RsvpStatus }) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RsvpStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rsvps) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rsvps]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rsvps.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (q) {
        const hay = `${r.name} ${r.email} ${r.company ?? ""} ${r.role ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rsvps, query, filter]);

  if (rsvps.length === 0) {
    return (
      <div className={s.empty}>
        <p>No RSVPs yet — they land here the moment someone submits the public page.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="tool-toolbar" style={{ flexWrap: "wrap", margin: "0 0 0.8rem" }}>
        <input
          className="tool-input"
          type="search"
          placeholder="Search name, company, or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: "1 1 220px", maxWidth: 340 }}
        />
        <span className="tool-count">
          {shown.length} of {rsvps.length}
        </span>
      </div>

      <div className={s.chips}>
        <button
          type="button"
          className={`${s.chip}${filter === "all" ? ` ${s.chipActive}` : ""}`}
          onClick={() => setFilter("all")}
        >
          All <span style={{ opacity: 0.65 }}>{rsvps.length}</span>
        </button>
        {RSVP_STATUSES.map((st) => (
          <button
            key={st}
            type="button"
            className={`${s.chip}${filter === st ? ` ${s.chipActive}` : ""}`}
            onClick={() => setFilter(st)}
          >
            {STATUS_LABEL[st]} <span style={{ opacity: 0.65 }}>{counts[st] ?? 0}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p style={{ opacity: 0.6 }}>No guests match.</p>
      ) : (
        <div className={s.guestList}>
          {shown.map((r) => {
            const open = openId === r.id;
            return (
              <div key={r.id} className={s.guestRow}>
                <div
                  className={s.guestTop}
                  onClick={() => setOpenId(open ? null : r.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setOpenId(open ? null : r.id)}
                >
                  <span className={s.guestName}>{r.name}</span>
                  {r.company && <span className={s.guestCo}>{r.company}</span>}
                  {r.role && <span className={s.roleChip}>{r.role}</span>}
                  {r.wantsToPlay && <span className={s.playTag}>⛳ wants to play</span>}
                  <span className={s.statusTag} style={{ background: STATUS_COLOR[r.status] }}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>

                {open && (
                  <div className={s.guestDetail}>
                    <a href={`mailto:${r.email}`}>{r.email}</a>
                    {r.message ? <p style={{ margin: "8px 0 0" }}>“{r.message}”</p> : null}
                    <p style={{ margin: "8px 0 0", fontSize: "0.78rem", opacity: 0.7 }}>
                      RSVP&apos;d{" "}
                      {new Date(r.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}

                <div className={s.guestActions}>
                  {ACTIONS.map((a) => (
                    <button
                      key={a.status}
                      type="button"
                      className={`${s.actBtn}${r.status === a.status ? ` ${s.actBtnOn}` : ""}`}
                      onClick={() => onPatch(r.id, { status: a.status })}
                      disabled={r.status === a.status}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
