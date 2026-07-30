import type { CsvRow } from "./types";

// Mirrors parseCSV in dashboard.html. Company can contain commas, so it's
// everything between the name (col 0) and the trailing votes/percentage cols.
export function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 4) continue;
    const name = cols[0].trim();
    const company = cols.slice(1, cols.length - 2).join(",").trim();
    const votes = parseInt(cols[cols.length - 2].trim(), 10) || 0;
    rows.push({ name, company, votes });
  }
  return rows;
}
