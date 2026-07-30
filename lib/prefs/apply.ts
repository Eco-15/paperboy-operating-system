"use client";

import {
  DENSITY_COOKIE,
  MOTION_COOKIE,
  PREF_COOKIE_MAX_AGE,
  THEME_COOKIE,
} from "./cookies";
import type { Density, Preferences, Theme } from "./types";

function setCookie(name: string, value: string) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${PREF_COOKIE_MAX_AGE};samesite=lax`;
  } catch {
    /* ignore */
  }
}

/** Resolve "system" to the OS preference; light/dark pass through. */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Stamp the appearance prefs onto <html> immediately (so a toggle feels instant)
 * and mirror them into cookies so the next SSR paints correctly.
 */
export function applyAppearance(p: Pick<Preferences, "theme" | "density" | "reduceMotion">) {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(p.theme);
  root.dataset.density = p.density;
  root.dataset.reduceMotion = p.reduceMotion ? "true" : "false";

  setCookie(THEME_COOKIE, p.theme); // store the raw choice, incl. "system"
  setCookie(DENSITY_COOKIE, p.density);
  setCookie(MOTION_COOKIE, p.reduceMotion ? "1" : "0");
}

/** Persist a partial preference patch to the DB. Returns the saved prefs. */
export async function savePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  const r = await fetch("/api/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error("Could not save preferences");
  return r.json();
}

/**
 * Keep the "system" theme live: when the OS flips light/dark and the user is on
 * "system", re-resolve. Returns an unsubscribe fn.
 */
export function watchSystemTheme(getTheme: () => Theme): () => void {
  let mq: MediaQueryList;
  try {
    mq = window.matchMedia("(prefers-color-scheme: dark)");
  } catch {
    return () => {};
  }
  const onChange = () => {
    if (getTheme() === "system") {
      document.documentElement.dataset.theme = mq.matches ? "dark" : "light";
    }
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export type { Density, Theme };
