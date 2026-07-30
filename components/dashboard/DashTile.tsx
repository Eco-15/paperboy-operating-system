"use client";

import Link from "next/link";
import type { Tile as TileData } from "@/lib/tiles";

// Softer, non-bricky dashboard card: rounded, gapped, subtle shadow, hover-lift.
export default function DashTile({ index, title, desc, stat, href }: TileData) {
  const isRoute = href.startsWith("/");
  // "/coming-soon…" tiles navigate (to an honest placeholder) but keep the muted
  // "soon" look — they aren't a finished tool yet.
  const isSoon = href.startsWith("/coming-soon");
  const live = isRoute && !isSoon;

  const inner = (
    <>
      <div className="dash-tile-top">
        <span className="dash-tile-index">{index}</span>
        <span className={`dash-tile-dot ${live ? "is-live" : ""}`} aria-hidden="true" />
      </div>
      <h3 className="dash-tile-title">{title}</h3>
      <p className="dash-tile-desc">{desc}</p>
      <div className="dash-tile-foot">
        <span className="dash-tile-stat">{stat}</span>
        <span className="dash-tile-arrow" aria-hidden="true">
          &#8250;
        </span>
      </div>
    </>
  );

  if (isRoute) {
    return (
      <Link className={`dash-tile ${isSoon ? "dash-tile--soon" : ""}`} href={href}>
        {inner}
      </Link>
    );
  }
  return (
    <a className="dash-tile dash-tile--soon" href={href} onClick={(e) => e.preventDefault()}>
      {inner}
    </a>
  );
}
