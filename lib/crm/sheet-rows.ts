import { parseCsv, normalizeDate } from "./csv";
import { ARCHIVE_STATUSES, ASSIGNABLE_STAGES } from "./stages";
import type { SheetSpec } from "./sheets";

// Turning a brand-application sheet into normalized rows, plus the identity rules
// used to decide whether two rows are the same company.
//
// Shared by the one-shot backfill (scripts/import-brand-apps.ts) and the live sync
// (lib/crm/sheet-sync.ts) so the two can never disagree about what a sheet says.

export interface SheetRow {
  company: string;
  category: string | null;
  subcategory: string | null;
  priority: number | null;
  stage: string | null;
  rawStage: string;
  contactName: string | null;
  contactEmail: string | null;
  message: string | null;
  dateSubmitted: string | null;
  website: string | null;
}

/** Loose key for comparing header names and company names. */
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// ── Stage vocabulary ─────────────────────────────────────────────────────────
// The older sheets predate the 2026-07 stage cleanup — collapse the old words.
const STAGE_MAP: Record<string, string> = { Inbound: "New", Diligence: "Closing" };
const KNOWN_STAGES = new Set([...ASSIGNABLE_STAGES, ...ARCHIVE_STATUSES]);

export function mapStage(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const mapped = STAGE_MAP[s] ?? s;
  return KNOWN_STAGES.has(mapped) ? mapped : null;
}

// ── Priority ─────────────────────────────────────────────────────────────────
// brand_app.priority is 1-6, 6 = highest, where 6 means "the deals that closed"
// (lib/db/schema.ts). The szn4 sheet scores applications 1-5.
//
// Direction confirmed by inspecting the real data rather than assumed: the
// distribution is a pyramid (1:20, 2:193, 3:158, 4:60, 5:4) and the ends read
// unambiguously — the four 5s are GENN / Mila / Swishables / Glimmr, while the 1s are
// off-thesis applicants for a CPG fund (Olivia Bottega Fashion Corp, NicomaNet
// Technologies). Higher is better on both scales, so they align directly.
//
// Mapping is therefore identity, NOT a stretch of 1-5 onto 1-6: 6 stays reserved for
// closed deals, which is not something an application score can confer.
export function mapPriority(raw: unknown): number | null {
  const n = Number(String(raw ?? "").trim());
  return Number.isInteger(n) && n >= 1 && n <= 6 ? n : null;
}

// ── Company identity ─────────────────────────────────────────────────────────

/** Bare registrable host: "https://www.Capecodr.com/x" → "capecodr.com". */
export function hostOf(url: string | null | undefined): string | null {
  const s = (url ?? "").trim();
  if (!s) return null;
  const host = s
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
  return host.includes(".") ? host : null;
}

/** Domain from an email address: "a@CapeCodr.com" → "capecodr.com". */
export function hostOfEmail(email: string | null | undefined): string | null {
  const s = (email ?? "").trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at < 0) return null;
  const host = s.slice(at + 1).replace(/^www\./, "");
  return host.includes(".") ? host : null;
}

// Free mailboxes say nothing about which company a row belongs to — matching on
// them would merge unrelated founders into one deal.
const PUBLIC_EMAIL_HOSTS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com",
  "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "live.com",
  "msn.com", "mac.com", "gmx.com", "yandex.com", "zoho.com",
]);

/**
 * The domain identifying a row's company, preferring the website over the email.
 *
 * This is what stops a website-derived name like "Capecodr" from being inserted as a
 * duplicate of the CRM's "Cape Cod'r" — three of the sheets have no company column
 * at all, so the domain is the only stable identity across them.
 */
export function identityHost(
  website: string | null | undefined,
  email: string | null | undefined,
): string | null {
  const w = hostOf(website);
  if (w) return w;
  const e = hostOfEmail(email);
  if (e && !PUBLIC_EMAIL_HOSTS.has(e)) return e;
  return null;
}

/**
 * Company name from a website when the sheet has no company column.
 * "https://www.heyozzi.com/x" → "Heyozzi".
 */
export function companyFromWebsite(url: string): string | null {
  const host = hostOf(url);
  if (!host) return null;
  const label = host.split(".")[0];
  if (!label || label.length < 2) return null;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// ── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Map one sheet's CSV to normalized rows.
 *
 * `skipped` holds rows that yielded no usable company name. They are returned rather
 * than dropped silently — a silent drop is how an application goes missing.
 */
export function parseSheetRows(
  spec: SheetSpec,
  csv: string,
): { rows: SheetRow[]; skipped: string[] } {
  const grid = parseCsv(csv);

  const hdrIdx = spec.headerOffset ?? 0;
  const header = (grid[hdrIdx] ?? []).map(norm);
  const dataRows = grid.slice(hdrIdx + 1).filter((r) => r.some((c) => c));

  const idx = (names: string[] | undefined): number => {
    for (const n of names ?? []) {
      const i = header.indexOf(norm(n));
      if (i >= 0) return i;
    }
    return -1;
  };

  /** Every matching column, for fields split across more than one (dates). */
  const allIdx = (names: string[] | undefined): number[] =>
    (names ?? []).map((n) => header.indexOf(norm(n))).filter((i) => i >= 0);

  const c = {
    company: idx(spec.columns.company),
    category: idx(spec.columns.category),
    subcategory: idx(spec.columns.subcategory),
    priority: idx(spec.columns.priority),
    stage: idx(spec.columns.stage),
    contactName: idx(spec.columns.contactName),
    contactEmail: idx(spec.columns.contactEmail),
    message: idx(spec.columns.message),
    dateSubmitted: allIdx(spec.columns.dateSubmitted),
    website: idx(spec.columns.website),
  };

  const at = (r: string[], i: number): string | null => (i >= 0 ? r[i]?.trim() || null : null);

  const rows: SheetRow[] = [];
  const skipped: string[] = [];

  for (const r of dataRows) {
    const website = at(r, c.website);
    const contactName = at(r, c.contactName);

    // Company: the sheet's own column, else derived from the website, else the
    // person's name.
    let company = at(r, c.company);
    if (!company && website) company = companyFromWebsite(website);
    if (!company && contactName) company = contactName;
    if (!company) {
      skipped.push(JSON.stringify(r).slice(0, 160));
      continue;
    }

    // Extra columns have no home in brand_app — fold them into the message as a
    // structured header rather than widening the schema (same shape app/api/apply
    // uses for website/raising/interest).
    const extraParts: string[] = [];
    for (const name of spec.columns.extras ?? []) {
      const i = header.indexOf(norm(name));
      const v = i >= 0 ? r[i]?.trim() : null;
      if (v) extraParts.push(`${name}: ${v}`);
    }
    const body = at(r, c.message);
    const message = [extraParts.join("\n"), body].filter(Boolean).join("\n\n") || null;

    const rawStage = c.stage >= 0 ? (r[c.stage] ?? "").trim() : "";

    rows.push({
      company,
      category: at(r, c.category),
      subcategory: at(r, c.subcategory),
      priority: mapPriority(c.priority >= 0 ? r[c.priority] : null),
      stage: mapStage(rawStage),
      rawStage,
      contactName,
      contactEmail: at(r, c.contactEmail),
      message,
      // First populated date column wins — these sheets split their timestamps
      // across two columns, each covering a different slice of the rows.
      dateSubmitted:
        c.dateSubmitted.map((i) => normalizeDate(r[i])).find((d) => d != null) ?? null,
      website,
    });
  }

  return { rows, skipped };
}
