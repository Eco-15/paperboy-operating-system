"use client";

// The Desk — who's signed in, doors into the rest of the OS (full console
// pages), and sign-out. Plain anchors on purpose: these leave the mobile
// shell for the desktop-grade tools.
import { signOut } from "next-auth/react";
import {
  CalendarIcon,
  ChevronIcon,
  DocIcon,
  LayoutIcon,
  NewspaperIcon,
  SignOutIcon,
  SlidersIcon,
} from "./icons";
import s from "./mobile.module.css";

function initials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

const TILES = [
  { href: "/events", label: "Events", sub: "Full console", Icon: CalendarIcon },
  { href: "/news", label: "The Paper", sub: "Daily editions", Icon: NewspaperIcon },
  { href: "/documents", label: "Documents", sub: "Library", Icon: DocIcon },
  { href: "/site-editor", label: "Site Editor", sub: "Public paper", Icon: LayoutIcon },
  { href: "/settings", label: "Settings", sub: "Appearance", Icon: SlidersIcon },
] as const;

export default function DeskTab({
  active,
  user,
}: {
  active: boolean;
  user: { name: string | null; email: string | null };
}) {
  return (
    <section className={`${s.pane} ${s.deskPane}${active ? ` ${s.paneActive}` : ""}`} aria-hidden={!active}>
      <div className={s.deskHeading}>The Desk</div>

      <div className={s.userCard}>
        <div className={s.avatar}>{initials(user.name, user.email)}</div>
        <div style={{ minWidth: 0 }}>
          <div className={s.userName}>{user.name || "Paperboy staff"}</div>
          {user.email ? <div className={s.userEmail}>{user.email}</div> : null}
        </div>
      </div>

      <div className={s.tileGrid}>
        {TILES.map(({ href, label, sub, Icon }) => (
          <a key={href} href={href} className={`${s.tile} ${s.press}`}>
            <span className={s.tileIcon}>
              <Icon />
            </span>
            <span>
              <span className={s.tileLabel}>{label}</span>
              <span className={s.tileSub} style={{ display: "block" }}>
                {sub}
              </span>
            </span>
            <span className={s.tileChevron}>
              <ChevronIcon />
            </span>
          </a>
        ))}
      </div>

      <button
        type="button"
        className={`${s.signOutRow} ${s.press}`}
        onClick={() => void signOut({ callbackUrl: "/login" })}
      >
        <SignOutIcon />
        Sign out
      </button>

      <div className={s.deskFoot}>Paperboy OS · Mobile</div>
    </section>
  );
}
