"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoAlbersUsa, geoPath, scaleSqrt, max } from "d3";
import { feature, mesh } from "topojson-client";
import type { Topology } from "topojson-specification";
import { PINS } from "@/lib/investors/data";
import type { Pin } from "@/lib/investors/types";

const WIDTH = 960;
const HEIGHT = 520;

const projection = geoAlbersUsa().scale(1100).translate([WIDTH / 2, HEIGHT / 2]);
const pathGen = geoPath(projection);

interface Tip {
  pin: Pin;
  x: number;
  y: number;
}

export default function InvestorMap() {
  const [topo, setTopo] = useState<Topology | null>(null);
  const [failed, setFailed] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/us-states-10m.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((json) => {
        if (alive) setTopo(json as Topology);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const geo = useMemo(() => {
    if (!topo) return null;
    // topojson's GeoJsonProperties typing is stricter than what feature/mesh
    // accept here; cast to bypass (runtime is unaffected).
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const t = topo as any;
    const states = t.objects.states;
    const land = feature(t, states) as unknown as GeoJSON.FeatureCollection;
    const borders = mesh(t, states, (a: any, b: any) => a !== b) as GeoJSON.MultiLineString;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    return {
      land: land.features.map((f) => pathGen(f) || ""),
      borders: pathGen(borders) || "",
    };
  }, [topo]);

  const usPins = useMemo(() => PINS.filter((p) => p.state !== "UK"), []);
  const maxCount = useMemo(() => max(usPins, (d) => d.count) || 1, [usPins]);
  const rScale = useMemo(
    () => scaleSqrt().domain([1, maxCount]).range([3.5, 14]),
    [maxCount]
  );
  const top5 = useMemo(
    () => [...usPins].sort((a, b) => b.count - a.count).slice(0, 5),
    [usPins]
  );

  if (failed) {
    return (
      <div className="tool-map-placeholder">
        Geographic view unavailable (map data failed to load).
      </div>
    );
  }
  if (!geo) {
    return <div className="tool-map-placeholder">Loading map…</div>;
  }

  function showTip(pin: Pin, e: React.MouseEvent) {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({ pin, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div className="tool-map-box" ref={boxRef}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", height: "auto" }}>
        <g>
          {geo.land.map((d, i) => (
            <path key={i} className="inv-land" d={d} />
          ))}
        </g>
        <path className="inv-state-border" d={geo.borders} />
        {usPins.map((p, i) => {
          const proj = projection([p.lng, p.lat]);
          if (!proj) return null;
          return (
            <circle
              key={`${p.city}-${i}`}
              className="inv-pin"
              cx={proj[0]}
              cy={proj[1]}
              r={rScale(p.count)}
              onMouseMove={(e) => showTip(p, e)}
              onMouseLeave={() => setTip(null)}
            />
          );
        })}
      </svg>

      {tip && (
        <div
          className="tool-map-tooltip"
          style={{ left: tip.x, top: tip.y, opacity: 1 }}
        >
          <strong>
            {tip.pin.city}, {tip.pin.state}
          </strong>{" "}
          — {tip.pin.count} investor{tip.pin.count > 1 ? "s" : ""}
          <br />
          {tip.pin.names.slice(0, 5).join(", ")}
          {tip.pin.names.length > 5 ? ` …+${tip.pin.names.length - 5} more` : ""}
        </div>
      )}

      <div className="inv-map-key">
        <div className="inv-map-key-title">Top Cities</div>
        {top5.map((d, i) => {
          const size = rScale(d.count) * 2;
          return (
            <div className="inv-map-key-row" key={i}>
              <span
                className="inv-map-key-dot"
                style={{ width: size, height: size }}
              />
              <span className="inv-map-key-label">
                {d.city}, {d.state}
              </span>
              <span className="inv-map-key-count">{d.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
