"use client";

import Link from "next/link";
import type { Tile as TileData } from "@/lib/tiles";

export default function Tile({ index, title, desc, stat, href }: TileData) {
  const inner = (
    <>
      <span className="tile-index">{index}</span>
      <h2 className="tile-title">{title}</h2>
      <p className="tile-desc">{desc}</p>
      <div className="tile-foot">
        <span className="tile-stat">{stat}</span>
        <span className="tile-arrow" aria-hidden="true">
          &#8250;
        </span>
      </div>
    </>
  );

  // Real routes (e.g. "/investors") navigate via next/link.
  // The aspirational stubs keep href="#" and stay put (no jump-scroll).
  if (href.startsWith("/")) {
    return (
      <Link className="tile" href={href}>
        {inner}
      </Link>
    );
  }

  return (
    <a className="tile" href={href} onClick={(e) => e.preventDefault()}>
      {inner}
    </a>
  );
}
