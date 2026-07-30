"use client";

import { useEffect, useState } from "react";
import type { EventRec } from "@/lib/events/types";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

// Create an event. POSTs to /api/events and hands the created record back so
// it appears at the top of the index immediately.
export default function NewEventModal({
  onCreate,
  onClose,
}: {
  onCreate: (event: EventRec) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [format, setFormat] = useState("golf");
  const [status, setStatus] = useState("draft");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const finalSlug = (slug || slugify(name)).trim();
    if (!finalSlug) {
      setError("Slug is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: finalSlug,
          date: date ? new Date(date).toISOString() : null,
          venue: venue.trim() || undefined,
          format: format || undefined,
          status,
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError(res.status === 409 ? "That slug is already taken." : "Couldn't create the event.");
        setBusy(false);
        return;
      }
      const { event } = (await res.json()) as { event: EventRec };
      onCreate(event);
      onClose();
    } catch {
      setError("Couldn't create the event.");
      setBusy(false);
    }
  }

  return (
    <div className="tool-modal-backdrop" onClick={onClose}>
      <div className="tool-modal" onClick={(e) => e.stopPropagation()}>
        <button className="tool-modal-close" type="button" onClick={onClose} aria-label="Close">
          &#x2715;
        </button>
        <h2>New Event</h2>
        <div className="tool-modal-meta">The public RSVP page goes live at /events/&lt;slug&gt;</div>

        <div className="tool-field">
          <label>Name *</label>
          <input
            className="tool-input"
            type="text"
            placeholder="e.g. Paperboy Invitational — Golf Party"
            value={name}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
              setError("");
            }}
          />
        </div>

        <div className="crm-form-row">
          <div className="tool-field">
            <label>Slug *</label>
            <input
              className="tool-input"
              type="text"
              placeholder="golf-party"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div className="tool-field">
            <label>Date (leave blank if TBA)</label>
            <input className="tool-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="crm-form-row">
          <div className="tool-field">
            <label>Venue</label>
            <input className="tool-input" type="text" placeholder="TBA" value={venue} onChange={(e) => setVenue(e.target.value)} />
          </div>
          <div className="tool-field">
            <label>Format</label>
            <select className="tool-select" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="golf">Golf</option>
              <option value="poker">Poker</option>
              <option value="dinner">Dinner</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="crm-form-row">
          <div className="tool-field">
            <label>Status</label>
            <select className="tool-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">Draft</option>
              <option value="live">Live — accepting RSVPs</option>
            </select>
          </div>
        </div>

        <div className="tool-field">
          <label>Description</label>
          <textarea
            className="tool-input"
            rows={3}
            placeholder="What guests see on the public page"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error && <div className="tool-sub-line" style={{ color: "#8b0000" }}>{error}</div>}

        <div className="tool-modal-actions">
          <button className="tool-btn" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="tool-btn tool-btn--solid" type="button" onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Create Event"}
          </button>
        </div>
      </div>
    </div>
  );
}
