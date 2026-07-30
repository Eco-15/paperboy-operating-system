"use client";

import { useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";
import type { Player } from "@/lib/poker/types";

export default function PokerCharts({
  players,
  eliminated,
}: {
  players: Player[];
  eliminated: Set<string>;
}) {
  const barRef = useRef<HTMLCanvasElement>(null);
  const pieRef = useRef<HTMLCanvasElement>(null);

  const real = players.filter((p) => p.name !== "HOLD" && p.votes > 0);
  const top = [...real].sort((a, b) => b.votes - a.votes).slice(0, 10);
  // Stable dependency key so the charts only rebuild when the data changes.
  const key = top.map((p) => `${p.name}:${p.votes}:${eliminated.has(p.name) ? 1 : 0}`).join("|");

  useEffect(() => {
    if (!barRef.current || !top.length) return;
    const chart = new Chart(barRef.current, {
      type: "bar",
      data: {
        labels: top.map((p) => p.name.split(" ")[0]),
        datasets: [
          {
            data: top.map((p) => p.votes),
            backgroundColor: top.map((p, i) =>
              eliminated.has(p.name)
                ? "hsla(0,70%,80%,1)"
                : i === 0
                ? "hsla(0,0%,0%,1)"
                : "hsla(0,0%,0%,.15)"
            ),
            borderRadius: 0,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#000",
            titleFont: { family: '"IBM Plex Mono"', size: 12 },
            bodyFont: { family: '"Ubuntu Mono"', size: 12 },
            callbacks: { label: (ctx) => ` ${ctx.raw} votes` },
          },
        },
        scales: {
          x: {
            ticks: { color: "hsla(0,0%,0%,.45)", font: { family: '"Ubuntu Mono"', size: 11 } },
            grid: { display: false },
            border: { color: "hsla(0,0%,0%,1)" },
          },
          y: {
            ticks: {
              color: "hsla(0,0%,0%,.45)",
              font: { family: '"Ubuntu Mono"', size: 11 },
              stepSize: 1,
            },
            grid: { color: "hsla(0,0%,0%,.08)" },
            border: { color: "hsla(0,0%,0%,1)" },
          },
        },
      },
    });
    return () => chart.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!pieRef.current || !top.length) return;
    const shades = top.map((p, i) =>
      eliminated.has(p.name) ? "hsla(0,70%,80%,1)" : `hsla(0,0%,${Math.round(10 + i * 8)}%,1)`
    );
    const chart = new Chart(pieRef.current, {
      type: "doughnut",
      data: {
        labels: top.map((p) => p.name.split(" ")[0]),
        datasets: [
          {
            data: top.map((p) => p.votes),
            backgroundColor: shades,
            borderColor: "hsla(46.15,26.53%,90.39%,1)",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: {
              font: { family: '"Ubuntu Mono"', size: 11 },
              color: "hsla(0,0%,0%,.75)",
              padding: 16,
            },
          },
          tooltip: {
            backgroundColor: "#000",
            titleFont: { family: '"IBM Plex Mono"', size: 12 },
            bodyFont: { family: '"Ubuntu Mono"', size: 12 },
            callbacks: { label: (ctx) => ` ${ctx.raw} votes` },
          },
        },
      },
    });
    return () => chart.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="tool-panels">
      <div className="tool-panel">
        <div className="tool-panel-title">Top 10 — Vote Distribution</div>
        {top.length ? (
          <div className="tool-chart-box" style={{ height: 300 }}>
            <canvas ref={barRef} />
          </div>
        ) : (
          <div className="tool-map-placeholder">No votes cast yet.</div>
        )}
      </div>
      <div className="tool-panel">
        <div className="tool-panel-title">Vote Share</div>
        {top.length ? (
          <div className="tool-chart-box" style={{ height: 300 }}>
            <canvas ref={pieRef} />
          </div>
        ) : (
          <div className="tool-map-placeholder">No votes cast yet.</div>
        )}
      </div>
    </div>
  );
}
