// Date formatting shared by the CRM's table, archive, tray and phone app.
// CLIENT-SAFE — no DB imports.

/** Display a deal's date. `brand_app` stores it free-text, so unparseable
 *  values pass through verbatim rather than showing "Invalid Date". */
export function fmtDate(v: string | null): string {
  if (!v) return "";
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) return v;
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Short absolute date, e.g. "Jul 28" — for the "new since …" line. */
export function fmtShortDate(v: string | null): string {
  if (!v) return "";
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) return v;
  const sameYear = t.getFullYear() === new Date().getFullYear();
  return t.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "just now" / "12m ago" / "3h ago" / "2d ago" / a date past a week. */
export function relativeTime(v: string | null): string {
  if (!v) return "";
  const then = new Date(v).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtShortDate(v);
}
