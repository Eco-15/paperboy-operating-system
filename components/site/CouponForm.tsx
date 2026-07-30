"use client";

import { useState } from "react";

// A newspaper "clip-out coupon" form: dashed border, Courier labels, ink
// button. One primitive drives every public form (apply, jobs, subscribe) —
// fields are config, the POST target is a prop, and success swaps the coupon
// for a printed confirmation line. Includes the honeypot field the API
// expects (hidden `company_website` input).

export type CouponField = {
  name: string;
  label: string;
  type?: "text" | "email" | "textarea" | "radios";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[]; // for radios
};

export default function CouponForm({
  title,
  action,
  fields,
  submitLabel,
  successLine,
  extra,
}: {
  title: string;
  action: string;
  fields: CouponField[];
  submitLabel: string;
  successLine: string;
  extra?: Record<string, string>; // constant payload fields, e.g. { list: "deals" }
}) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "busy") return;
    setError(null);
    setState("busy");

    const fd = new FormData(e.currentTarget);
    const payload: Record<string, string> = { ...(extra ?? {}) };
    fd.forEach((v, k) => {
      payload[k] = String(v);
    });

    try {
      const res = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const first = data?.fields ? Object.values(data.fields)[0] : null;
        throw new Error(typeof first === "string" ? first : "Please check the form and try again.");
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
        <div className="sheet-coupon-title">{title}</div>
        <p className="sheet-coupon-success">{successLine}</p>
      </div>
    );
  }

  return (
    <form className="sheet-coupon" onSubmit={onSubmit}>
      <div className="sheet-coupon-title">{title}</div>
      {fields.map((f) => (
        <label key={f.name} className="sheet-coupon-field">
          <span className="sheet-coupon-label">{f.label}</span>
          {f.type === "textarea" ? (
            <textarea
              name={f.name}
              rows={4}
              required={f.required}
              placeholder={f.placeholder}
            />
          ) : f.type === "radios" ? (
            <span className="sheet-coupon-radios">
              {(f.options ?? []).map((o, i) => (
                <label key={o.value}>
                  <input
                    type="radio"
                    name={f.name}
                    value={o.value}
                    defaultChecked={i === 0}
                    required={f.required}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </span>
          ) : (
            <input
              type={f.type ?? "text"}
              name={f.name}
              required={f.required}
              placeholder={f.placeholder}
            />
          )}
        </label>
      ))}
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
        {state === "busy" ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}
