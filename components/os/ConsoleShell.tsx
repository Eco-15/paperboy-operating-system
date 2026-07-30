"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import OsTopBar from "./OsTopBar";
import OsNavRail from "./OsNavRail";
import CommandPalette from "./CommandPalette";
import ShortcutsHelp from "./ShortcutsHelp";
import PreferencesProvider, { usePreferences } from "./PreferencesProvider";
import ToastHost from "./ToastHost";
import { toast } from "@/lib/notify/toast";
import type { Preferences } from "@/lib/prefs/types";

export interface ShellUser {
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

// The persistent Salesforce-console shell: a top utility bar + a left nav rail
// that stay mounted across route changes (this lives in app/(os)/layout.tsx,
// so the rail + its collapse state survive navigation with no re-mount flash).
//
// Preferences (theme/density/motion/rail) come from the DB via the layout, so
// they're server-rendered correctly and sync across devices.
export default function ConsoleShell({
  user,
  prefs,
  children,
}: {
  user: ShellUser | null;
  prefs: Preferences;
  children: ReactNode;
}) {
  return (
    <PreferencesProvider initial={prefs}>
      <ShellInner user={user}>{children}</ShellInner>
    </PreferencesProvider>
  );
}

function ShellInner({ user, children }: { user: ShellUser | null; children: ReactNode }) {
  const { prefs, update } = usePreferences();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Rail collapse lives in preferences (server-rendered), so there's no
  // post-mount flash and the choice follows the user across devices.
  const collapsed = prefs.railCollapsed;

  // Global keyboard shortcuts: ⌘K/Ctrl+K opens the command palette; "?" opens
  // the shortcuts panel (ignored while typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "?" && !typing) {
        e.preventDefault();
        setHelpOpen((o) => !o);
      } else if (e.key === "Escape") {
        setHelpOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPalette = useCallback(() => setPaletteOpen(true), []);

  const toggle = useCallback(() => {
    update({ railCollapsed: !collapsed }).catch(() => toast("Couldn't save that", { type: "error" }));
  }, [collapsed, update]);

  return (
    <div className="os-shell" data-collapsed={collapsed}>
      <a href="#os-main" className="skip-link">Skip to content</a>
      <OsTopBar user={user} onToggleRail={toggle} onSearch={openPalette} />
      <div className="os-body">
        <OsNavRail />
        <div className="os-content" id="os-main" tabIndex={-1}>
          {children}
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ToastHost />
    </div>
  );
}
