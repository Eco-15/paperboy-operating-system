import type { TalentRec } from "./types";

// The active talent pipeline — these five are the kanban columns, in order.
// Mirrors lib/crm/stages.ts; parked outcomes are ARCHIVE_STATUSES below.
export const UNSTAGED = "Unstaged";
export const STAGE_ORDER = [
  "New",
  "Vetting",
  "Intro'd",
  "Interviewing",
  "Placed",
  UNSTAGED,
];

// The stages an operator can assign in the UI (add-form + detail editor +
// Kanban columns). Excludes the synthetic UNSTAGED bucket.
export const ASSIGNABLE_STAGES = STAGE_ORDER.filter((s) => s !== UNSTAGED);

// Statuses a person can carry while archived (why they left the pipeline).
// Assignable from the archive/detail views, never board columns.
export const ARCHIVE_STATUSES = ["Passed", "Hold", "Bench"];

// Every stage value the API accepts (board stages + archive statuses).
export const ALL_STATUSES = [...ASSIGNABLE_STAGES, ...ARCHIVE_STATUSES];

export const STAGE_COLOR: Record<string, string> = {
  New: "#16a34a",
  Vetting: "#d97706",
  "Intro'd": "#2563eb",
  Interviewing: "#7c3aed",
  Placed: "#0ea5e9",
  Passed: "#9ca3af",
  Hold: "#a16207",
  Bench: "#64748b",
};

export function stageColor(stage: string): string {
  return STAGE_COLOR[stage] ?? "#9ca3af";
}

// A person's effective stage bucket — blank/whitespace collapses to UNSTAGED.
export function stageKey(t: Pick<TalentRec, "stage">): string {
  return t.stage && t.stage.trim() ? t.stage.trim() : UNSTAGED;
}

// Present stages across the roster, sorted by STAGE_ORDER (unknowns after).
export function stageList(talent: TalentRec[]): string[] {
  const present = new Set(talent.map(stageKey));
  return [...present].sort((a, b) => {
    const ia = STAGE_ORDER.indexOf(a);
    const ib = STAGE_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
}
