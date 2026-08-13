import "./env";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { SHEETS, type SheetSpec } from "../lib/crm/sheets";
import { exportSheetCsv } from "./drive-fetch";

// READ-ONLY. Touches Drive and nothing else — no DB connection, no writes.
//
// Exists to settle two things the importer must not guess:
//   1. Where the real header row is (the Drive index truncates headers, and two
//      sheets came back looking like they have junk leading columns).
//   2. The priority scale on szn4 — labelled "Priority (1-5)" while brand_app.priority
//      is documented 1-6 with 6 = highest. Which end means "best" changes every score.
//
//   npx tsx scripts/inspect-brand-app-sheets.ts
//   npx tsx scripts/inspect-brand-app-sheets.ts --only szn4
//   npx tsx scripts/inspect-brand-app-sheets.ts --cached   # reuse downloaded CSVs
//
// Downloaded CSVs are cached so repeat runs don't re-hit Drive.

const CACHE_DIR = join(process.cwd(), ".sheet-cache");

const args = process.argv.slice(2);
const CACHED = args.includes("--cached");
const onlyFlag = args.indexOf("--only");
const only = onlyFlag >= 0 ? args[onlyFlag + 1] : null;

async function fetchCsv(spec: SheetSpec): Promise<string> {
  const cachePath = join(CACHE_DIR, `${spec.key}.csv`);
  if (CACHED && existsSync(cachePath)) return readFileSync(cachePath, "utf8");

  const csv = await exportSheetCsv(spec.fileId);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, csv, "utf8");
  return csv;
}

/** Raw grid — no header assumption at all, so we can see what row 1 actually is. */
function grid(csv: string): string[][] {
  const wb = XLSX.read(csv, { type: "string" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils
    .sheet_to_json<string[]>(sheet, { header: 1, defval: "", blankrows: false })
    .map((r) => r.map((c) => String(c ?? "").trim()));
}

/** All header names this spec hopes to find, flattened. */
function wantedHeaders(spec: SheetSpec): string[] {
  return Object.values(spec.columns).flat().filter(Boolean) as string[];
}

const loose = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The header row is the one matching the most names we expect. Scanning instead of
 * assuming row 1 is the point of this script — two sheets look offset.
 */
function findHeaderRow(rows: string[][], spec: SheetSpec): { index: number; score: number } {
  const wanted = new Set(wantedHeaders(spec).map(loose));
  let best = { index: 0, score: -1 };
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const score = rows[i].filter((c) => c && wanted.has(loose(c))).length;
    if (score > best.score) best = { index: i, score };
  }
  return best;
}

function report(spec: SheetSpec, csv: string) {
  const rows = grid(csv);
  console.log(`\n${"═".repeat(78)}`);
  console.log(`${spec.label}`);
  console.log(`  key=${spec.key}  file=${spec.fileId}`);
  console.log(`  raw rows (incl. header): ${rows.length}`);

  const { index: hdrIdx, score } = findHeaderRow(rows, spec);
  console.log(`  header row detected at index ${hdrIdx} (matched ${score} expected names)`);
  if (hdrIdx !== 0) {
    console.log(`  ⚠ header is NOT row 1 — set headerOffset: ${hdrIdx} in scripts/sheets.ts`);
  }

  console.log(`\n  --- rows 0..${Math.min(4, rows.length - 1)} raw ---`);
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const marker = i === hdrIdx ? "H" : " ";
    console.log(`  ${marker}[${i}] ${JSON.stringify(rows[i]).slice(0, 400)}`);
  }

  const header = rows[hdrIdx] ?? [];
  console.log(`\n  --- actual header (${header.length} cols) ---`);
  header.forEach((h, i) => console.log(`    ${String(i).padStart(2)}: ${JSON.stringify(h)}`));

  // Which of our guessed mappings actually resolve? This is the real payload:
  // an unresolved column silently drops that field for every row in the sheet.
  console.log(`\n  --- column map resolution ---`);
  const headerLoose = header.map(loose);
  for (const [field, names] of Object.entries(spec.columns)) {
    if (field === "extras") continue;
    const list = names as string[];
    const hit = list.find((n) => headerLoose.includes(loose(n)));
    if (hit) {
      console.log(`    ✓ ${field.padEnd(14)} → ${JSON.stringify(hit)}`);
    } else {
      console.log(`    ✗ ${field.padEnd(14)} → NOT FOUND (tried ${JSON.stringify(list)})`);
    }
  }
  const extras = (spec.columns.extras ?? []).filter((n) => headerLoose.includes(loose(n)));
  if (spec.columns.extras?.length) {
    console.log(`      extras resolved: ${extras.length}/${spec.columns.extras.length}`);
  }
  const unmapped = header.filter(
    (h) => h && !wantedHeaders(spec).some((w) => loose(w) === loose(h)),
  );
  if (unmapped.length) {
    console.log(`    · unmapped columns present in sheet: ${JSON.stringify(unmapped)}`);
  }

  // Data rows, using the detected header.
  const dataRows = rows.slice(hdrIdx + 1).filter((r) => r.some((c) => c));
  console.log(`\n  data rows: ${dataRows.length}`);

  const col = (name: string | undefined) =>
    name == null ? -1 : headerLoose.indexOf(loose(name));

  const companyCol = col((spec.columns.company ?? []).find((n) => headerLoose.includes(loose(n))));
  const websiteCol = col((spec.columns.website ?? []).find((n) => headerLoose.includes(loose(n))));
  const nameCol = col((spec.columns.contactName ?? []).find((n) => headerLoose.includes(loose(n))));

  if (companyCol < 0) {
    // Matters: these sheets need a company derived from website/person, and we
    // need to know how many rows would be unusable.
    const noWebsite = dataRows.filter((r) => !(websiteCol >= 0 && r[websiteCol])).length;
    const noAnything = dataRows.filter(
      (r) => !(websiteCol >= 0 && r[websiteCol]) && !(nameCol >= 0 && r[nameCol]),
    ).length;
    console.log(`  ⚠ no company column. rows lacking website: ${noWebsite}; lacking website AND name: ${noAnything} (these would be skipped)`);
  } else {
    const blank = dataRows.filter((r) => !r[companyCol]).length;
    console.log(`  rows with blank company: ${blank}`);
  }

  // Priority distribution — the whole reason this script exists for szn4.
  const priName = (spec.columns.priority ?? []).find((n) => headerLoose.includes(loose(n)));
  if (priName) {
    const pcol = col(priName);
    const dist = new Map<string, number>();
    for (const r of dataRows) {
      const v = (r[pcol] ?? "").trim() || "(blank)";
      dist.set(v, (dist.get(v) ?? 0) + 1);
    }
    console.log(`\n  --- PRIORITY distribution (${JSON.stringify(priName)}) ---`);
    for (const [v, n] of [...dist.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true }),
    )) {
      console.log(`    ${v.padEnd(10)} ${n}`);
    }

    // Sample the top and bottom of the scale so the direction is readable from
    // the company names rather than assumed.
    const vals = [...dist.keys()].filter((v) => /^\d+$/.test(v)).map(Number).sort((a, b) => a - b);
    if (vals.length && companyCol >= 0) {
      const lo = String(vals[0]);
      const hi = String(vals[vals.length - 1]);
      const sample = (want: string) =>
        dataRows
          .filter((r) => (r[pcol] ?? "").trim() === want && r[companyCol])
          .slice(0, 8)
          .map((r) => r[companyCol]);
      console.log(`    companies at LOW  end (${lo}): ${JSON.stringify(sample(lo))}`);
      console.log(`    companies at HIGH end (${hi}): ${JSON.stringify(sample(hi))}`);
    }
  }
}

async function main() {
  const targets = only ? SHEETS.filter((s) => s.key === only) : SHEETS;
  if (!targets.length) {
    console.error(`No sheet with key "${only}". Known: ${SHEETS.map((s) => s.key).join(", ")}`);
    process.exit(1);
  }
  console.log(`Inspecting ${targets.length} sheet(s)${CACHED ? " (cached)" : " from Drive"}…`);

  for (const spec of targets) {
    try {
      report(spec, await fetchCsv(spec));
    } catch (e) {
      console.log(`\n${"═".repeat(78)}`);
      console.log(`${spec.label}\n  ✗ FETCH FAILED: ${e instanceof Error ? e.message.slice(0, 200) : e}`);
    }
  }

  console.log(`\n${"═".repeat(78)}`);
  console.log(`CSVs cached in ${CACHE_DIR} — rerun with --cached to skip Drive.`);
}

main().catch((e) => {
  console.error("Inspect failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
