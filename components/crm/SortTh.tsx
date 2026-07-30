"use client";

import type { SortCol, SortState } from "@/lib/crm/sort";

// A sortable table header. Click cycles descending → ascending → off (see
// nextSortState). Shared by the CRM table and the archive so both feel the same.
export default function SortTh({
  col,
  label,
  sort,
  onSort,
  align,
}: {
  col: SortCol;
  label: string;
  sort: SortState;
  onSort: (col: SortCol) => void;
  align?: "right";
}) {
  const active = sort?.col === col;
  const dir = active ? sort.dir : null;
  return (
    <th
      className={`crm-th-sort${active ? " crm-th-sort--active" : ""}`}
      onClick={() => onSort(col)}
      title={`Sort by ${label.toLowerCase()}`}
      aria-sort={dir ? (dir === "asc" ? "ascending" : "descending") : "none"}
      style={align === "right" ? { textAlign: "right" } : undefined}
    >
      {label}
      <span className="crm-th-arrow" aria-hidden="true">
        {dir ? (dir === "desc" ? "▼" : "▲") : "↕"}
      </span>
    </th>
  );
}
