"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS, tilesBySection } from "@/lib/tiles";
import RailIcon from "./RailIcon";

// Persistent left navigation rail. Lists the OS modules grouped by section
// (source of truth: lib/tiles.ts) with a Home item on top; the active route is
// highlighted via usePathname. Collapses to glyph-only from the top-bar toggle.
export default function OsNavRail() {
  const pathname = usePathname();

  function isActive(href: string) {
    const path = href.split("?")[0];
    if (path === "/coming-soon") return false; // shared by several "soon" tiles
    return pathname === path || pathname.startsWith(path + "/");
  }

  return (
    <nav className="os-rail" aria-label="Modules">
      <div className="os-rail-group">
        <Link
          className={`os-rail-item${pathname === "/dashboard" ? " os-rail-item--active" : ""}`}
          href="/dashboard"
          aria-current={pathname === "/dashboard" ? "page" : undefined}
        >
          <span className="os-rail-glyph" aria-hidden="true">
            <RailIcon name="Home" />
          </span>
          <span className="os-rail-label">Home</span>
        </Link>
      </div>

      {SECTIONS.map((section) => (
        <div className="os-rail-group" key={section.key}>
          <div className="os-rail-group-label">{section.label}</div>
          {tilesBySection(section.key).map((tile) => {
            const soon = tile.href.split("?")[0] === "/coming-soon";
            const active = isActive(tile.href);
            return (
              <Link
                key={tile.index}
                href={tile.href}
                className={
                  "os-rail-item" +
                  (active ? " os-rail-item--active" : "") +
                  (soon ? " os-rail-item--soon" : "")
                }
                title={tile.title}
                aria-current={active ? "page" : undefined}
              >
                <span className="os-rail-glyph" aria-hidden="true">
                  <RailIcon name={tile.title} />
                </span>
                <span className="os-rail-label">{tile.title}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
