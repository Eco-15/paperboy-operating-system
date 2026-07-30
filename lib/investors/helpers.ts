import type { Investor } from "./types";

/** Normalize a URL: null if empty/placeholder, else ensure an https:// prefix. */
export function norm(u?: string): string | null {
  if (!u || u.startsWith("[No")) return null;
  return u.startsWith("http") ? u : "https://" + u;
}

/** The clean dataset uses "LinkedIn"; tolerate the legacy "LinkedIn " key too. */
export function linkedinOf(row: Investor): string | undefined {
  return row["LinkedIn "] || row.LinkedIn;
}

/** Badge variant class for a given investor type. */
export function badgeClass(t: string): string {
  if (t === "Angel Group") return "inv-badge inv-badge--angel";
  if (t === "VC") return "inv-badge inv-badge--vc";
  return "inv-badge inv-badge--family";
}
