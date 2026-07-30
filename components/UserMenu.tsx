"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

// Styling lives in globals.css (.usermenu-*) rather than inline objects, so the
// menu picks up the theme tokens and flips correctly in dark mode.
export default function UserMenu({
  name,
  email,
  role,
}: {
  name?: string | null;
  email?: string | null;
  role?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const label = name || email || "Account";
  const staff = role === "admin" || role === "internal";

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="usermenu" ref={wrapRef}>
      <button
        className="user-chip"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {label} &#9662;
      </button>
      {open && (
        <div role="menu" className="usermenu-panel">
          {email && <div className="usermenu-email">{email}</div>}
          {role && <div className="usermenu-role">{role}</div>}
          <a href="/settings" className="usermenu-item">Settings</a>
          {staff && (
            <>
              <a href="/admin/invites" className="usermenu-item">Invitations</a>
              <a href="/admin/investors" className="usermenu-item">Investor Relations</a>
            </>
          )}
          <button
            type="button"
            className="usermenu-item"
            onClick={() => signOut({ redirectTo: "/login" })}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
