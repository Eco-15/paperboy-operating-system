import "./env";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { db, pool } from "../lib/db";
import { brandApps } from "../lib/db/schema";
import { ARCHIVE_STATUSES, ASSIGNABLE_STAGES } from "../lib/crm/stages";

// One-shot repair for the "only 47 deals / no priority scores" gap: reconciles
// brand_app against Kyle's master pipeline sheet ("Move to Airtable" in Drive —
// the sheet his Airtable was populated from, with the Priority column intact).
//
//   npx tsx scripts/import-deal-priorities.ts            # dry run vs Drive
//   npx tsx scripts/import-deal-priorities.ts --apply    # write changes
//   npx tsx scripts/import-deal-priorities.ts --csv path/to/export.csv --apply
//
// Drive fetch uses ADC (same as the ingest job): if `gcloud auth
// application-default login` lacks the Drive scope, download the sheet as CSV
// from the browser and pass --csv instead.
//
// Rules: match on normalized company name. Fill NULL fields from the sheet
// (priority, stage, category, subcategory, website, contact). A non-null DB
// priority that disagrees with the sheet is reported, not overwritten (use
// --force to make the sheet win). Sheet rows with no DB match are inserted —
// parked stages (Passed/Hold/Watch) arrive archived, everything else active.

const SHEET_FILE_ID = "1L0F2zkHR8qIixZ2SVY_Epa8ftwPedj7qhdMGUm3Dxh8";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const FORCE = args.includes("--force");
const csvFlag = args.indexOf("--csv");
const csvPath = csvFlag >= 0 ? args[csvFlag + 1] : null;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// The sheet predates the 2026-07 stage cleanup — collapse the old vocabulary.
const STAGE_MAP: Record<string, string> = { Inbound: "New", Diligence: "Closing" };
const KNOWN_STAGES = new Set([...ASSIGNABLE_STAGES, ...ARCHIVE_STATUSES]);

function mapStage(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const mapped = STAGE_MAP[s] ?? s;
  return KNOWN_STAGES.has(mapped) ? mapped : null;
}

function mapPriority(raw: unknown): number | null {
  const n = Number(String(raw ?? "").trim());
  return Number.isInteger(n) && n >= 1 && n <= 6 ? n : null;
}

async function fetchSheetCsv(): Promise<string> {
  if (csvPath) return readFileSync(csvPath, "utf8");
  const { getDriveClient } = await import("../lib/rag/drive");
  const drive = getDriveClient();
  const res = await drive.files.export(
    { fileId: SHEET_FILE_ID, mimeType: "text/csv" },
    { responseType: "text" },
  );
  return String(res.data);
}

interface SheetRow {
  company: string;
  category: string | null;
  subcategory: string | null;
  source: string | null;
  priority: number | null;
  stage: string | null;
  rawStage: string;
  contactName: string | null;
  contactEmail: string | null;
  message: string | null;
  dateSubmitted: string | null;
  website: string | null;
}

function parseSheet(csv: string): SheetRow[] {
  const wb = XLSX.read(csv, { type: "string" });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], {
    defval: "",
  });
  const str = (r: Record<string, unknown>, k: string) => String(r[k] ?? "").trim() || null;
  return rows
    .map((r) => ({
      company: String(r["Company"] ?? "").trim(),
      category: str(r, "Category"),
      subcategory: str(r, "Subcategory"),
      source: str(r, "Inbound"),
      priority: mapPriority(r["Priority"]),
      stage: mapStage(String(r["Stage"] ?? "")),
      rawStage: String(r["Stage"] ?? "").trim(),
      contactName: str(r, "Contact Name"),
      contactEmail: str(r, "Contact Email"),
      message: str(r, "Message"),
      dateSubmitted: str(r, "Date Submitted"),
      website: str(r, "Website"),
    }))
    .filter((r) => r.company.length > 0);
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "dry run (pass --apply to write)"}${FORCE ? " + force" : ""}`);

  const sheet = parseSheet(await fetchSheetCsv());
  console.log(`Sheet rows: ${sheet.length} (${sheet.filter((r) => r.priority != null).length} carry a priority)`);

  const existing = await db.select().from(brandApps);
  console.log(`brand_app rows before: ${existing.length}`);

  const byName = new Map<string, (typeof existing)[number]>();
  for (const row of existing) {
    const key = norm(row.company);
    if (key && !byName.has(key)) byName.set(key, row);
  }

  let filled = 0;
  let conflicts = 0;
  let inserted = 0;
  let untouched = 0;
  const conflictList: string[] = [];
  const unknownStages = new Map<string, number>();

  for (const row of sheet) {
    if (row.rawStage && !row.stage) {
      unknownStages.set(row.rawStage, (unknownStages.get(row.rawStage) ?? 0) + 1);
    }
    const match = byName.get(norm(row.company));

    if (match) {
      const patch: Partial<typeof brandApps.$inferInsert> = {};
      if (row.priority != null) {
        if (match.priority == null) patch.priority = row.priority;
        else if (match.priority !== row.priority) {
          conflicts++;
          conflictList.push(`${row.company}: db P${match.priority} vs sheet P${row.priority}`);
          if (FORCE) patch.priority = row.priority;
        }
      }
      if (row.stage && !match.stage?.trim()) patch.stage = row.stage;
      if (row.category && !match.category) patch.category = row.category;
      if (row.subcategory && !match.subcategory) patch.subcategory = row.subcategory;
      if (row.website && !match.website) patch.website = row.website;
      if (row.contactName && !match.contactName) patch.contactName = row.contactName;
      if (row.contactEmail && !match.contactEmail) patch.contactEmail = row.contactEmail;

      if (Object.keys(patch).length === 0) {
        untouched++;
        continue;
      }
      filled++;
      if (APPLY) await db.update(brandApps).set(patch).where(eq(brandApps.id, match.id));
    } else {
      inserted++;
      if (APPLY) {
        await db.insert(brandApps).values({
          company: row.company,
          category: row.category,
          subcategory: row.subcategory,
          source: row.source ?? "Airtable master import (Jul 2026)",
          priority: row.priority,
          stage: row.stage,
          contactName: row.contactName,
          contactEmail: row.contactEmail,
          message: row.message,
          website: row.website,
          dateSubmitted: row.dateSubmitted,
          archived: row.stage != null && ARCHIVE_STATUSES.includes(row.stage),
        });
      }
    }
  }

  console.log(`Matched & updated: ${filled}   already complete: ${untouched}   inserted: ${inserted}`);
  if (conflicts) {
    console.log(`Priority conflicts (${FORCE ? "overwritten via --force" : "kept DB value; rerun with --force for sheet"}): ${conflicts}`);
    for (const c of conflictList.slice(0, 20)) console.log(`  · ${c}`);
    if (conflictList.length > 20) console.log(`  · …and ${conflictList.length - 20} more`);
  }
  if (unknownStages.size) {
    console.log(
      "Unmapped sheet stages (left null): " +
        [...unknownStages.entries()].map(([s, n]) => `"${s}"×${n}`).join(", "),
    );
  }

  if (APPLY) {
    const after = await db.select().from(brandApps);
    const withPri = after.filter((r) => r.priority != null).length;
    console.log(`brand_app rows after: ${after.length} (${withPri} rated, ${after.length - withPri} unrated)`);
  }

  await pool.end();
}

main().catch((e) => {
  console.error("Import failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
