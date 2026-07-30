"use client";

import { useState } from "react";
import { GUEST_ROLES } from "@/lib/events/types";

// The RSVP clip-out coupon for the public event page. Same bones as the site's
// CouponForm, plus the two fields events need: a role radio set and the
// "I'd like to play" checkbox. Posts to /api/events/rsvp with the honeypot.
export default function RsvpCoupon({ slug }: { slug: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "busy") return;
    setError(null);
    setState("busy");

    const fd = new FormData(e.currentTarget);
    const payload = {
      slug,
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      company: String(fd.get("company") ?? ""),
      role: String(fd.get("role") ?? "") || undefined,
      wantsToPlay: fd.get("wantsToPlay") === "on",
      message: String(fd.get("message") ?? ""),
      company_website: String(fd.get("company_website") ?? ""),
    };

    try {
      const res = await fetch("/api/events/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const first = data?.fields ? Object.values(data.fields)[0] : null;
        throw new Error(
          typeof first === "string" ? first : "Please check the form and try again.",
        );
      }
      setState("done");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Something went wrong — try again.");
    }
  }

  if (state === "done") {
    return (
      <div className="sheet-coupon sheet-coupon--done">
        <div className="sheet-coupon-title">Request an Invitation</div>
        <p className="sheet-coupon-success">
          You&apos;re on the list — watch your inbox. Invitations are confirmed personally by
          the Paperboy team.
        </p>
      </div>
    );
  }

  return (
    <form className="sheet-coupon" onSubmit={onSubmit}>
      <div className="sheet-coupon-title">Request an Invitation</div>

      <label className="sheet-coupon-field">
        <span className="sheet-coupon-label">Full name</span>
        <input type="text" name="name" required placeholder="Your name" />
      </label>

      <label className="sheet-coupon-field">
        <span className="sheet-coupon-label">Email</span>
        <input type="email" name="email" required placeholder="you@firm.com" />
      </label>

      <label className="sheet-coupon-field">
        <span className="sheet-coupon-label">Company / fund</span>
        <input type="text" name="company" placeholder="Optional" />
      </label>

      <label className="sheet-coupon-field">
        <span className="sheet-coupon-label">I am a…</span>
        <span className="sheet-coupon-radios">
          {GUEST_ROLES.map((r, i) => (
            <label key={r}>
              <input type="radio" name="role" value={r} defaultChecked={i === 0} />
              <span>{r}</span>
            </label>
          ))}
        </span>
      </label>

      <label className="sheet-coupon-field">
        <span className="sheet-coupon-radios">
          <label>
            <input type="checkbox" name="wantsToPlay" />
            <span>I&apos;d like to play in the tournament</span>
          </label>
        </span>
      </label>

      <label className="sheet-coupon-field">
        <span className="sheet-coupon-label">Note to the publisher</span>
        <textarea name="message" rows={3} placeholder="Optional — who you'd love to meet, dietary notes, handicap brags" />
      </label>

      {/* Honeypot — humans never see it; bots that fill it get a quiet 200. */}
      <input
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="sheet-coupon-hp"
      />

      {error ? <p className="sheet-coupon-error">{error}</p> : null}
      <button className="sheet-coupon-submit" type="submit" disabled={state === "busy"}>
        {state === "busy" ? "Sending…" : "Request Invitation"}
      </button>
    </form>
  );
}
