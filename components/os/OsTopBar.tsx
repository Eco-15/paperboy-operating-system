"use client";

import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import AskLauncher from "./AskLauncher";
import NotificationBell from "./NotificationBell";
import type { ShellUser } from "./ConsoleShell";

// Served locally (public/icons) — also the PWA app icon; no CDN hotlink.
const LOGO_SRC = "/icons/logo-master.png";

// Global utility bar: brand + rail toggle on the left, a global search in the
// middle, and the Ask-Paperboy launcher + account menu on the right.
export default function OsTopBar({
  user,
  onToggleRail,
  onSearch,
}: {
  user: ShellUser | null;
  onToggleRail: () => void;
  onSearch: () => void;
}) {
  return (
    <header className="os-topbar">
      <button
        className="os-rail-toggle"
        type="button"
        onClick={onToggleRail}
        aria-label="Toggle navigation"
      >
        ☰
      </button>
      <Link className="os-topbar-brand" href="/dashboard">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="os-topbar-logo" src={LOGO_SRC} alt="Paperboy" />
        <span className="os-topbar-name">Paperboy OS</span>
      </Link>

      <button className="os-search" type="button" onClick={onSearch} aria-label="Search Paperboy OS">
        <span>Search modules, investors, deals…</span>
        <kbd className="os-search-kbd">⌘K</kbd>
      </button>

      <div className="os-utility">
        <AskLauncher />
        {user ? (
          <>
            <NotificationBell />
            <UserMenu name={user.name} email={user.email} role={user.role} />
          </>
        ) : (
          <Link className="user-chip" href="/login">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
