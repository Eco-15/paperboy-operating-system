// Exact CSV parsing for the brand-application sheets.
//
// The obvious move is XLSX.read(csv) — the repo already depends on `xlsx` — but it
// type-infers on read, and these sheets defeat it: a "Submitted On" cell holding
// "09/09/2025 12:11:57" comes back as the Excel serial 45909.50829861111 with
// raw:true, or as the truncated "9/9/25" with raw:false. Neither round-trips.
//
// The application messages contain commas, quotes, and hard newlines, so the parser
// has to be a real RFC 4180 one rather than a split(","). It is short enough to own.

/** Parse RFC 4180 CSV into a grid of exact strings. Handles quoted fields containing , " and \n. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  // Strip a UTF-8 BOM — Drive exports include one and it corrupts the first header.
  if (input.charCodeAt(0) === 0xfeff) i = 1;

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Trailing field/row with no terminating newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.map((r) => r.map((c) => c.trim()));
}

/**
 * Normalize the sheets' date formats to ISO `YYYY-MM-DD`.
 *
 * Sheets export as US "MM/DD/YYYY HH:MM:SS"; a few legacy cells are raw Excel
 * serials. Returns null rather than guessing when the value is neither, so a bad
 * cell leaves dateSubmitted empty instead of writing a wrong date into the CRM.
 */
export function normalizeDate(value: string | null | undefined): string | null {
  const s = (value ?? "").trim();
  if (!s) return null;

  // MM/DD/YYYY or M/D/YY, optionally followed by a time.
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, mo, d, y, hh, mi, ss] = m;
    let year = Number(y);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    const dt = new Date(
      Date.UTC(year, Number(mo) - 1, Number(d), Number(hh ?? 0), Number(mi ?? 0), Number(ss ?? 0)),
    );
    return Number.isFinite(dt.getTime()) ? dt.toISOString().slice(0, 10) : null;
  }

  // Excel serial day count. Epoch is 1899-12-30 (Lotus leap-year bug included).
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    // Below ~1000 this is far more likely a ranking or a stray integer than a date.
    if (serial < 1000 || serial > 80000) return null;
    const ms = Math.round((serial - 25569) * 86400 * 1000);
    const dt = new Date(ms);
    return Number.isFinite(dt.getTime()) ? dt.toISOString().slice(0, 10) : null;
  }

  // Anything already ISO-ish.
  const dt = new Date(s);
  return Number.isFinite(dt.getTime()) ? dt.toISOString().slice(0, 10) : null;
}
