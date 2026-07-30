import type { Deal } from "./types";

// The active pipeline — these five are the kanban columns, in order.
// (2026-07 cleanup: the old 10-stage vocabulary was collapsed. Parked outcomes
// — Passed / Hold / Watch — are ARCHIVE_STATUSES below, not board columns.)
export const UNSTAGED = "Unstaged";
export const STAGE_ORDER = [
  "New",
  "Outreach",
  "Founder Call",
  "Closing",
  "Closed",
  UNSTAGED,
];

// The stages an operator can assign in the UI (add-form + detail editor +
// Kanban columns). Excludes the synthetic UNSTAGED bucket.
export const ASSIGNABLE_STAGES = STAGE_ORDER.filter((s) => s !== UNSTAGED);

// Statuses a deal can carry while archived (why it left the pipeline). Also
// accepted by the PATCH API so legacy rows keep their meaning; assignable from
// the archive/detail views, never board columns.
export const ARCHIVE_STATUSES = ["Passed", "Hold", "Watch"];

// Every stage value the API accepts (board stages + archive statuses).
export const ALL_STATUSES = [...ASSIGNABLE_STAGES, ...ARCHIVE_STATUSES];

// The funds a deal can be tagged with. The CRM shows one tab per fund.
export const FUNDS = ["Fund I", "Fund II"];

export const STAGE_COLOR: Record<string, string> = {
  New: "#16a34a",
  Outreach: "#d97706",
  "Founder Call": "#2563eb",
  Closing: "#7c3aed",
  Closed: "#0ea5e9",
  Passed: "#9ca3af",
  Hold: "#a16207",
  Watch: "#64748b",
};

export function stageColor(stage: string): string {
  return STAGE_COLOR[stage] ?? "#9ca3af";
}

// A deal's effective stage bucket — blank/whitespace collapses to UNSTAGED.
export function stageKey(d: Pick<Deal, "stage">): string {
  return d.stage && d.stage.trim() ? d.stage.trim() : UNSTAGED;
}

// Present stages across the given deals, sorted by STAGE_ORDER (unknowns after).
export function stageList(deals: Deal[]): string[] {
  const present = new Set(deals.map(stageKey));
  return [...present].sort((a, b) => {
    const ia = STAGE_ORDER.indexOf(a);
    const ib = STAGE_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
}
