// Deal ordering, shared by every CRM surface: the desktop table headers, the
// board's card order, the archive table, and the phone app's sort sheet. One
// module so "sorted by stage" means the same thing everywhere.
//
// CLIENT-SAFE — only imports ./types and ./stages. Never import lib/db here.
import { STAGE_ORDER, stageKey } from "./stages";
import type { Deal } from "./types";

export type SortCol =
  | "company"
  | "fund"
  | "category"
  | "stage"
  | "priority"
  | "contact"
  | "date";

export type SortDir = "asc" | "desc";
export type SortState = { col: SortCol; dir: SortDir } | null;

/**
 * The fields sorting actually reads. Stated as a Pick rather than `Deal` so the
 * phone app's `LiteDeal` (Deal minus the long-text fields) sorts too.
 */
export type SortableDeal = Pick<
  Deal,
  | "company"
  | "fund"
  | "category"
  | "subcategory"
  | "stage"
  | "contactName"
  | "priority"
  | "date"
  | "arrivedAt"
>;

/** The sortable columns, in table-header order. One list, used by every UI. */
export const SORT_COLUMNS: { col: SortCol; label: string }[] = [
  { col: "company", label: "Company" },
  { col: "fund", label: "Fund" },
  { col: "category", label: "Category" },
  { col: "stage", label: "Stage" },
  { col: "priority", label: "Priority" },
  { col: "contact", label: "Contact" },
  { col: "date", label: "Date" },
];

/** Short header labels (the table has less room than a sort menu). */
export const SORT_TH_LABELS: Record<SortCol, string> = {
  company: "Company",
  fund: "Fund",
  category: "Category",
  stage: "Stage",
  priority: "Pri",
  contact: "Contact",
  date: "Date",
};

/**
 * A deal's sortable timestamp. `date` is what the row displays, but for
 * `brand_app` it's the free-text `date_submitted` column and often doesn't
 * parse — fall back to the real `created_at` so the Date column is never
 * a pile of unsorted blanks.
 */
export function dealTime(d: SortableDeal): number {
  for (const v of [d.date, d.arrivedAt]) {
    if (!v) continue;
    const t = new Date(v).getTime();
    if (Number.isFinite(t)) return t;
  }
  return NaN;
}

/** Whether a deal has nothing to sort on for this column. */
export function colEmpty(d: SortableDeal, col: SortCol): boolean {
  switch (col) {
    case "company":
      return !d.company;
    case "fund":
      return !d.fund;
    case "category":
      return !d.category;
    case "stage":
      return !d.stage?.trim();
    case "contact":
      return !d.contactName;
    case "priority":
      return d.priority == null;
    case "date":
      return Number.isNaN(dealTime(d));
  }
}

function str(va: string | null, vb: string | null): number {
  const empty = (v: string | null) => v == null || v === "";
  if (empty(va) && empty(vb)) return 0;
  if (empty(va)) return 1;
  if (empty(vb)) return -1;
  return (va as string).localeCompare(vb as string, undefined, { sensitivity: "base" });
}

function stageRank(d: SortableDeal): number {
  const i = STAGE_ORDER.indexOf(stageKey(d));
  return i < 0 ? 99 : i;
}

/**
 * Per-column comparators, always ascending — `sortDeals` applies the direction.
 * Stage compares by pipeline position (New → Outreach → … → Closed), not
 * alphabetically, so "descending stage" means late-stage first.
 */
export function colCompare(a: SortableDeal, b: SortableDeal, col: SortCol): number {
  switch (col) {
    case "company":
      return str(a.company, b.company);
    case "fund":
      return str(a.fund, b.fund);
    case "category":
      return str(a.category, b.category) || str(a.subcategory, b.subcategory);
    case "stage":
      return stageRank(a) - stageRank(b) || str(stageKey(a), stageKey(b));
    case "contact":
      return str(a.contactName, b.contactName);
    case "priority": {
      if (a.priority == null && b.priority == null) return 0;
      if (a.priority == null) return 1;
      if (b.priority == null) return -1;
      return a.priority - b.priority;
    }
    case "date": {
      const ta = dealTime(a);
      const tb = dealTime(b);
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return ta - tb;
    }
  }
}

/**
 * Sort a copy of `deals`. Empty values always sink to the bottom regardless of
 * direction, so flipping a column never buries the real data under blanks.
 * A null sort returns the input untouched (the API's newest-first order).
 */
export function sortDeals<T extends SortableDeal>(deals: T[], sort: SortState): T[] {
  if (!sort) return deals;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...deals].sort((a, b) => {
    const ea = colEmpty(a, sort.col);
    const eb = colEmpty(b, sort.col);
    if (ea && eb) return 0;
    if (ea) return 1;
    if (eb) return -1;
    return colCompare(a, b, sort.col) * dir;
  });
}

/**
 * Header-click cycle: a new column starts descending (the biggest thing on
 * top), then ascending, then off.
 */
export function nextSortState(current: SortState, col: SortCol): SortState {
  if (!current || current.col !== col) return { col, dir: "desc" };
  if (current.dir === "desc") return { col, dir: "asc" };
  return null;
}

const SORT_COLS = new Set<string>(SORT_COLUMNS.map((c) => c.col));

/** Coerce anything (a localStorage blob, a URL param) into a valid sort. */
export function parseSortState(value: unknown): SortState {
  if (!value || typeof value !== "object") return null;
  const { col, dir } = value as { col?: unknown; dir?: unknown };
  if (typeof col !== "string" || !SORT_COLS.has(col)) return null;
  if (dir !== "asc" && dir !== "desc") return null;
  return { col: col as SortCol, dir };
}
