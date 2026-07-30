"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const LINKS = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/updates", label: "Updates" },
  { href: "/portal/documents", label: "Documents" },
  { href: "/portal/portfolio", label: "Portfolio" },
];

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="lp-nav" aria-label="Investor portal">
      {LINKS.map((l) => {
        const active =
          l.href === "/portal" ? pathname === "/portal" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={"lp-nav-link" + (active ? " is-active" : "")}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PortalSignOut({ label }: { label?: string | null }) {
  return (
    <div className="lp-masthead-user">
      {label && <span>{label}</span>}
      <button
        type="button"
        className="lp-signout"
        onClick={() => signOut({ redirectTo: "/login" })}
      >
        Sign out
      </button>
    </div>
  );
}
