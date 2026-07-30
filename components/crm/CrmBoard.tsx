"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Deal, DealOrigin } from "@/lib/crm/types";
import { ASSIGNABLE_STAGES, stageColor, stageKey, stageList } from "@/lib/crm/stages";

// Kanban board over the same deals the table shows. Columns are the assignable
// stages (always visible so you can drop into empty ones) plus any other stage
// that currently holds deals (e.g. "Unstaged"). Drag a card to a column to
// change its stage — the parent persists it via PATCH and keeps table + board
// in sync. Clicking a card (without dragging) opens its detail page.
//
// Card order within a column is whatever order the parent hands down, so the
// toolbar's sort control drives the board and the table identically.
export default function CrmBoard({
  deals,
  onMove,
  newIds,
}: {
  deals: Deal[];
  onMove: (id: string, origin: DealOrigin, stage: string) => void;
  /** Ids that arrived since this user last looked — badged NEW. */
  newIds?: Set<string>;
}) {
  const router = useRouter();
  const dragging = useRef<{ id: string; origin: DealOrigin; stage: string } | null>(null);
  const didDrag = useRef(false);
  const [overStage, setOverStage] = useState<string | null>(null);

  // All assignable columns, then any extra present stages (Unstaged / unknown).
  const columns = [...ASSIGNABLE_STAGES];
  for (const s of stageList(deals)) if (!columns.includes(s)) columns.push(s);

  const byStage: Record<string, Deal[]> = {};
  for (const d of deals) (byStage[stageKey(d)] ??= []).push(d);

  return (
    <div className="crm-board">
      {columns.map((col) => {
        const items = byStage[col] ?? [];
        return (
          <div
            key={col}
            className={`crm-col${overStage === col ? " crm-col--over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (overStage !== col) setOverStage(col);
            }}
            onDragLeave={() => setOverStage((s) => (s === col ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setOverStage(null);
              const d = dragging.current;
              dragging.current = null;
              if (d && d.stage !== col) onMove(d.id, d.origin, col);
            }}
          >
            <div className="crm-col-head">
              <span className="crm-col-dot" style={{ background: stageColor(col) }} />
              <span className="crm-col-name">{col}</span>
              <span className="crm-col-count">{items.length}</span>
            </div>

            <div className="crm-cards">
              {items.map((d) => (
                <div
                  key={d.id}
                  className="crm-card"
                  draggable
                  style={{ borderLeftColor: stageColor(col) }}
                  onDragStart={(e) => {
                    dragging.current = { id: d.id, origin: d.origin, stage: col };
                    didDrag.current = true;
                    e.dataTransfer.effectAllowed = "move";
                    e.currentTarget.classList.add("crm-card--dragging");
                  }}
                  onDragEnd={(e) => {
                    e.currentTarget.classList.remove("crm-card--dragging");
                    setOverStage(null);
                    // Let the click that browsers may fire after a drag be ignored.
                    setTimeout(() => {
                      didDrag.current = false;
                    }, 0);
                  }}
                  onClick={() => {
                    if (didDrag.current) return;
                    router.push(`/crm/${d.id}`);
                  }}
                >
                  <div className="crm-card-company">
                    {d.company}
                    {newIds?.has(d.id) && <span className="crm-badge-new">NEW</span>}
                    {d.archived && <span className="crm-parked-tag">parked</span>}
                  </div>
                  {(d.category || d.subcategory) && (
                    <div className="crm-card-meta">
                      {d.category}
                      {d.subcategory ? ` · ${d.subcategory}` : ""}
                    </div>
                  )}
                  <div className="crm-card-foot">
                    <span className="crm-card-contact">
                      {d.fund ? <span className="crm-fund-chip">{d.fund}</span> : d.contactName ?? ""}
                    </span>
                    {d.priority != null && (
                      <span className={`crm-pri${d.priority >= 5 ? " crm-pri--high" : ""}`}>P{d.priority}</span>
                    )}
                  </div>
                </div>
              ))}
              {items.length === 0 && <div className="crm-col-empty">Drop here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
