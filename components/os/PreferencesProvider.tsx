"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { applyAppearance, savePreferences, watchSystemTheme } from "@/lib/prefs/apply";
import type { Preferences } from "@/lib/prefs/types";

interface Ctx {
  prefs: Preferences;
  /** Optimistically apply a patch, then persist it. Reverts if the save fails. */
  update: (patch: Partial<Preferences>) => Promise<void>;
  saving: boolean;
}

const PreferencesContext = createContext<Ctx | null>(null);

/** Read the live preferences. Must be used inside the OS shell. */
export function usePreferences(): Ctx {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}

// Holds the single source of client-side truth for preferences. Seeded from the
// DB by the (os) layout, so it's correct on first paint and across devices.
export default function PreferencesProvider({
  initial,
  children,
}: {
  initial: Preferences;
  children: ReactNode;
}) {
  const [prefs, setPrefs] = useState<Preferences>(initial);
  const [saving, setSaving] = useState(false);

  // Keep a ref so the matchMedia listener always sees the current theme without
  // needing to be torn down and re-attached on every change.
  const themeRef = useRef(prefs.theme);
  themeRef.current = prefs.theme;

  // Reconcile the appearance cookies/DOM with the DB values we were handed. This
  // is what makes a theme set on another device take effect here.
  useEffect(() => {
    applyAppearance(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => watchSystemTheme(() => themeRef.current), []);

  const update = useCallback(
    async (patch: Partial<Preferences>) => {
      const prev = prefs;
      const next = { ...prefs, ...patch };
      setPrefs(next); // optimistic — the UI responds instantly
      applyAppearance(next);
      setSaving(true);
      try {
        const saved = await savePreferences(patch);
        setPrefs(saved);
        applyAppearance(saved);
      } catch {
        setPrefs(prev); // roll back on failure
        applyAppearance(prev);
        throw new Error("Could not save your preferences");
      } finally {
        setSaving(false);
      }
    },
    [prefs],
  );

  return (
    <PreferencesContext.Provider value={{ prefs, update, saving }}>
      {children}
    </PreferencesContext.Provider>
  );
}
