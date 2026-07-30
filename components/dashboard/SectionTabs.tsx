"use client";

import { useState } from "react";
import { SECTIONS, tilesBySection, type Section } from "@/lib/tiles";
import DashTile from "./DashTile";

export default function SectionTabs() {
  const [active, setActive] = useState<Section>("investment");
  const tiles = tilesBySection(active);

  return (
    <section>
      <div className="dash-tabs">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`dash-tab ${active === s.key ? "dash-tab--active" : ""}`}
            onClick={() => setActive(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="dash-grid">
        {tiles.map((t) => (
          <DashTile key={t.index} {...t} />
        ))}
      </div>
    </section>
  );
}
