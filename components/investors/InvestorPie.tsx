"use client";

import { useEffect, useRef } from "react";
import { Chart, type ChartConfiguration } from "chart.js/auto";
import type { TypeCounts } from "@/lib/investors/types";

// Warm beige palette matching the OS aesthetic (from the original pie).
const COLORS = ["hsl(46,22%,55%)", "hsl(46,26%,66%)", "hsl(46,30%,72%)", "hsl(46,18%,46%)"];

export default function InvestorPie({ counts }: { counts: TypeCounts }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const labels = Object.keys(counts);
    const values = Object.values(counts);

    const config: ChartConfiguration = {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length]),
            borderColor: "hsl(0,0%,0%)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              font: { family: "Ubuntu Mono, monospace", size: 12 },
              color: "hsl(0,0%,0%)",
              boxWidth: 12,
            },
          },
        },
      },
    };

    const chart = new Chart(canvas, config);
    // StrictMode double-invokes effects in dev — destroy on cleanup so the
    // canvas isn't "already in use" on the second mount.
    return () => chart.destroy();
  }, [counts]);

  return (
    <div className="tool-chart-box" style={{ height: 260 }}>
      <canvas ref={ref} />
    </div>
  );
}
