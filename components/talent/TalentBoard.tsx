"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TalentRec } from "@/lib/talent/types";
import { ASSIGNABLE_STAGES, stageColor, stageKey, stageList } from "@/lib/talent/stages";

// Kanban board over the same people the table shows. Columns are the
// assignable stages (always visible so you can drop into empty ones) plus any
// other stage that currently holds people (e.g. "Unstaged"). Drag a card to a
// column to change its stage — the parent persists it via PATCH. Clicking a
// card (without dragging) opens its detail page. Mirrors components/crm/CrmBoard.
export default function TalentBoard({
  talent,
  onMove,
}: {
  talent: TalentRec[];
  onMove: (id: string, stage: string) => void;
}) {
  const router = useRouter();
  const dragging = useRef<{ id: string; stage: string } | null>(null);
  const didDrag = useRef(false);
  const [overStage, setOverStage] = useState<string | null>(null);

  const columns = [...ASSIGNABLE_STAGES];
  for (const s of stageList(talent)) if (!columns.includes(s)) columns.push(s);

  const byStage: Record<string, TalentRec[]> = {};
  for (const t of talent) (byStage[stageKey(t)] ??= []).push(t);

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
              if (d && d.stage !== col) onMove(d.id, col);
            }}
          >
            <div className="crm-col-head">
              <span className="crm-col-dot" style={{ background: stageColor(col) }} />
              <span className="crm-col-name">{col}</span>
              <span className="crm-col-count">{items.length}</span>
            </div>

            <div className="crm-cards">
              {items.map((t) => (
                <div
                  key={t.id}
                  className="crm-card"
                  draggable
                  style={{ borderLeftColor: stageColor(col) }}
                  onDragStart={(e) => {
                    dragging.current = { id: t.id, stage: col };
                    didDrag.current = true;
                    e.dataTransfer.effectAllowed = "move";
                    e.currentTarget.classList.add("crm-card--dragging");
                  }}
                  onDragEnd={(e) => {
                    e.currentTarget.classList.remove("crm-card--dragging");
                    setOverStage(null);
                    setTimeout(() => {
                      didDrag.current = false;
                    }, 0);
                  }}
                  onClick={() => {
                    if (didDrag.current) return;
                    router.push(`/talent/${t.id}`);
                  }}
                >
                  <div className="crm-card-company">
                    {t.name}
                    {t.source === "Talent network signup" && col === "New" && (
                      <span className="crm-badge-new">NEW</span>
                    )}
                  </div>
                  {(t.role || t.company) && (
                    <div className="crm-card-meta">
                      {t.role}
                      {t.role && t.company ? " · " : ""}
                      {t.company}
                    </div>
                  )}
                  <div className="crm-card-foot">
                    <span className="crm-card-contact">{t.location ?? ""}</span>
                    {t.priority != null && (
                      <span className={`crm-pri${t.priority >= 5 ? " crm-pri--high" : ""}`}>P{t.priority}</span>
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
