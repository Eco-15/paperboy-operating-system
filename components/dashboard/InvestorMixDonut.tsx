"use client";

import { useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";

// Investor mix by type (Angel / VC / Family office) as a tan-toned doughnut.
// Repurposed from the old dashboard Overview bar chart; keeps the single
// chart.js dependency. `data` comes from /api/dashboard/stats typeCounts.
const COLORS = [
  "hsl(38,54%,47%)", // accent bronze
  "hsl(46,30%,72%)", // tan-3
  "hsl(46,22%,55%)",
  "hsl(38,40%,34%)",
  "hsl(46,26%,84%)",
];

export default function InvestorMixDonut({
  data,
}: {
  data: Record<string, number> | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current || !data) return;
    const labels = Object.keys(data);
    const values = Object.values(data);
    const chart = new Chart(ref.current, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length]),
            borderColor: "#fff",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "hsla(0,0%,0%,.6)",
              font: { family: '"Ubuntu Mono"', size: 10 },
              boxWidth: 10,
              padding: 10,
            },
          },
          tooltip: { callbacks: { label: (c) => ` ${c.raw} investors` } },
        },
      },
    });
    return () => chart.destroy();
  }, [data]);

  return <canvas ref={ref} />;
}
