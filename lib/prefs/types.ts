// Shared preference types + defaults. No DB / server imports here so this module
// is safe to import from client components (the Settings UI, the shell, etc.).
import type { NotifyCategory, NotifyPrefs } from "@/lib/db/schema";

export type Theme = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";
export type DateFormat = "auto" | "mdy" | "dmy" | "iso";

/** The fully-resolved preferences the UI works with (never null fields). */
export interface Preferences {
  theme: Theme;
  density: Density;
  reduceMotion: boolean;
  railCollapsed: boolean;
  timezone: string | null; // null = follow the browser
  dateFormat: DateFormat;
  notify: NotifyPrefs;
}

// Notification categories surfaced in Settings, in display order. `email` is
// stored but inert until an outbound mailer exists (see the Settings UI).
export const NOTIFY_CATEGORIES: {
  key: NotifyCategory;
  label: string;
  desc: string;
}[] = [
  { key: "sync", label: "Sync status", desc: "When your Google calendar & inbox finish syncing." },
  { key: "leads", label: "New leads & call list", desc: "New webinar leads and call-list activity." },
  { key: "newsletter", label: "Newsletter activity", desc: "Subscriber and campaign updates." },
  { key: "team", label: "Invites & team", desc: "When invites are accepted or members change." },
];

export const DEFAULT_NOTIFY: NotifyPrefs = {
  sync: { inApp: true, email: false },
  leads: { inApp: true, email: false },
  newsletter: { inApp: true, email: false },
  team: { inApp: true, email: false },
};

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  density: "comfortable",
  reduceMotion: false,
  railCollapsed: false,
  timezone: null,
  dateFormat: "auto",
  notify: DEFAULT_NOTIFY,
};

const THEMES: Theme[] = ["light", "dark", "system"];
const DENSITIES: Density[] = ["comfortable", "compact"];
const DATE_FORMATS: DateFormat[] = ["auto", "mdy", "dmy", "iso"];

/** Coerce an arbitrary DB row / patch body into a valid Preferences object. */
export function normalizePreferences(row: Partial<{
  theme: string | null;
  density: string | null;
  reduceMotion: boolean | null;
  railCollapsed: boolean | null;
  timezone: string | null;
  dateFormat: string | null;
  notifyPrefs: NotifyPrefs | null;
}>): Preferences {
  const notify = row.notifyPrefs ?? DEFAULT_NOTIFY;
  return {
    theme: THEMES.includes(row.theme as Theme) ? (row.theme as Theme) : DEFAULT_PREFERENCES.theme,
    density: DENSITIES.includes(row.density as Density) ? (row.density as Density) : DEFAULT_PREFERENCES.density,
    reduceMotion: !!row.reduceMotion,
    railCollapsed: !!row.railCollapsed,
    timezone: row.timezone || null,
    dateFormat: DATE_FORMATS.includes(row.dateFormat as DateFormat) ? (row.dateFormat as DateFormat) : "auto",
    // Fill any missing categories with their default so the UI never sees a hole.
    notify: {
      sync: notify.sync ?? DEFAULT_NOTIFY.sync,
      leads: notify.leads ?? DEFAULT_NOTIFY.leads,
      newsletter: notify.newsletter ?? DEFAULT_NOTIFY.newsletter,
      team: notify.team ?? DEFAULT_NOTIFY.team,
    },
  };
}
