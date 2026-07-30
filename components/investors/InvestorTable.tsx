"use client";

import type { Investor, SortCol } from "@/lib/investors/types";
import { badgeClass, linkedinOf, norm } from "@/lib/investors/helpers";

const COLUMNS: { col: SortCol; label: string }[] = [
  { col: "Type", label: "Type" },
  { col: "Group Name", label: "Name" },
  { col: "City", label: "City" },
  { col: "State", label: "State" },
];

export default function InvestorTable({
  rows,
  sortCol,
  sortDir,
  onSort,
  onSelect,
}: {
  rows: Investor[];
  sortCol: SortCol | null;
  sortDir: 1 | -1;
  onSort: (col: SortCol) => void;
  onSelect: (row: Investor) => void;
}) {
  return (
    <div className="tool-table-wrap">
      <table className="tool-table">
        <thead>
          <tr>
            {COLUMNS.map(({ col, label }) => (
              <th
                key={col}
                className="sortable"
                onClick={() => onSort(col)}
                aria-sort={sortCol === col ? (sortDir === 1 ? "ascending" : "descending") : "none"}
              >
                {label}
                {sortCol === col ? (sortDir === 1 ? " ▲" : " ▼") : ""}
              </th>
            ))}
            <th>Links</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)" }}>
                No investors match your search.
              </td>
            </tr>
          )}
          {rows.map((row, i) => {
            const w = norm(row.Website);
            const li = norm(linkedinOf(row));
            return (
              <tr
                key={`${row["Group Name"]}-${i}`}
                className="clickable"
                onClick={() => onSelect(row)}
              >
                <td>
                  <span className={badgeClass(row.Type)}>{row.Type}</span>
                </td>
                <td>{row["Group Name"]}</td>
                <td>{row.City || ""}</td>
                <td>{row.State || ""}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="inv-links">
                    {w && (
                      <a className="tool-link" href={w} target="_blank" rel="noopener noreferrer">
                        Website
                      </a>
                    )}
                    {li && (
                      <a className="tool-link" href={li} target="_blank" rel="noopener noreferrer">
                        LinkedIn
                      </a>
                    )}
                  </div>
                </td>
                <td>
                  <div className="inv-summary-short">{row.Summary || ""}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
