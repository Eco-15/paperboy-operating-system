"use client";

import { useEffect, useState } from "react";
import InvestorMixDonut from "./InvestorMixDonut";

interface DashStats {
  investors: number;
  blogPosts: number;
  brandsTracked: number;
  openDeals: number;
  typeCounts: Record<string, number>;
}

// The top of the dashboard: four big-number KPI tiles + an investor-mix donut,
// all from a single /api/dashboard/stats fetch (Salesforce Analytics style).
export default function KpiRow() {
  const [stats, setStats] = useState<DashStats | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((d) => active && setStats(d))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const tiles = [
    { label: "Investors", value: stats ? stats.investors.toLocaleString() : "—" },
    { label: "Brands tracked", value: stats ? String(stats.brandsTracked) : "—" },
    { label: "Open deals", value: stats ? String(stats.openDeals) : "—" },
    { label: "Blog posts", value: stats ? String(stats.blogPosts) : "—" },
  ];

  return (
    <section className="kpi-row">
      {tiles.map((t) => (
        <div className="kpi-tile" key={t.label}>
          <div className="kpi-label">{t.label}</div>
          {stats ? <div className="kpi-value">{t.value}</div> : <div className="skel kpi-skel" />}
          <div className="kpi-accent" />
        </div>
      ))}
      <div className="kpi-donut-card">
        <div className="kpi-donut-title">Investor mix</div>
        <div className="kpi-donut-box">
          <InvestorMixDonut data={stats?.typeCounts ?? null} />
        </div>
      </div>
    </section>
  );
}
