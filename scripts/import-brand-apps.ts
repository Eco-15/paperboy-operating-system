import "./env";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db, pool } from "../lib/db";
import { brandApps } from "../lib/db/schema";
import { ARCHIVE_STATUSES } from "../lib/crm/stages";
import { SHEETS, type SheetSpec } from "../lib/crm/sheets";
import { exportSheetCsv } from "./drive-fetch";
import {
  parseSheetRows,
  norm,
  identityHost,
  type SheetRow,
} from "../lib/crm/sheet-rows";

// Reconciles every brand-application sheet (Seasons 1-4) against brand_app, so the
// CRM holds every company that has applied plus its prioritization score.
//
// Generalizes scripts/import-deal-priorities.ts, which does the same for the single
// "Move to Airtable" sheet. That sheet and "Updates 1.23.26" are already imported and
// are deliberately not in SHEETS.
//
//   npx tsx scripts/import-brand-apps.ts                  # dry run vs Drive
//   npx tsx scripts/import-brand-apps.ts --cached         # dry run vs cached CSVs
//   npx tsx scripts/import-brand-apps.ts --apply          # write changes
//   npx tsx scripts/import-brand-apps.ts --only szn4 --apply
//
// Rules: match on normalized company name, across sheets AND against existing rows.
// Fill NULL fields from the sheet. A non-null DB priority that disagrees is REPORTED,
// not overwritten (--force makes the sheet win). Sheets run oldest → newest, so later
// seasons fill what earlier ones left blank. Unmatched rows are inserted.

const CACHE_DIR = join(process.cwd(), ".sheet-cache");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const FORCE = args.includes("--force");
const CACHED = args.includes("--cached");
// Parse and report without touching Postgres — validates every sheet mapping and
// the cross-sheet dedupe when the DB is unreachable. Implies a dry run.
const OFFLINE = args.includes("--offline");
const onlyFlag = args.indexOf("--only");
const only = onlyFlag >= 0 ? args[onlyFlag + 1] : null;
// Print the first N mapped rows per sheet — eyeball the mapping before writing.
const sampleFlag = args.indexOf("--sample");
const SAMPLE = sampleFlag >= 0 ? Number(args[sampleFlag + 1] ?? 3) : 0;


// ── Sheet reading ────────────────────────────────────────────────────────────

async function fetchCsv(spec: SheetSpec): Promise<string> {
  const cachePath = join(CACHE_DIR, `${spec.key}.csv`);
  if (CACHED && existsSync(cachePath)) return readFileSync(cachePath, "utf8");
  const csv = await exportSheetCsv(spec.fileId);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, csv, "utf8");
  return csv;
}


// ── Reconciliation ───────────────────────────────────────────────────────────

interface Tally {
  read: number;
  filled: number;
  inserted: number;
  untouched: number;
  skipped: number;
  conflicts: number;
}

async function main() {
  console.log(
    `Mode: ${APPLY ? "APPLY" : "dry run (pass --apply to write)"}` +
      `${FORCE ? " + force" : ""}${CACHED ? " + cached" : ""}` +
      "",
  );

  const targets = only ? SHEETS.filter((s) => s.key === only) : SHEETS;
  if (!targets.length) {
    console.error(`No sheet with key "${only}". Known: ${SHEETS.map((s) => s.key).join(", ")}`);
    process.exit(1);
  }

  if (OFFLINE && APPLY) {
    console.error("--offline cannot be combined with --apply.");
    process.exit(1);
  }

  const existing = OFFLINE ? [] : await db.select().from(brandApps);
  console.log(
    OFFLINE
      ? `brand_app: NOT READ (offline) — every sheet company counts as an insert\n`
      : `brand_app rows before: ${existing.length}\n`,
  );

  // One index for everything: existing rows plus anything we insert as we go, so a
  // brand appearing in szn2 and szn4 becomes one deal rather than two.
  type Entry = { id: string | null; row: Partial<typeof brandApps.$inferSelect>; from: string };
  const byName = new Map<string, Entry>();
  // Secondary index. Three sheets have no company column at all, so their names are
  // derived from the website ("Capecodr") and would never string-match a CRM row
  // called "Cape Cod'r" — inserting a duplicate instead of enriching the real deal.
  // The domain is the stable identity across all of them.
  const byHost = new Map<string, Entry>();

  for (const row of existing) {
    const entry: Entry = { id: row.id, row, from: "db" };
    const key = norm(row.company);
    if (key && !byName.has(key)) byName.set(key, entry);
    const host = identityHost(row.website, row.contactEmail);
    if (host && !byHost.has(host)) byHost.set(host, entry);
  }

  const conflictList: string[] = [];
  const unknownStages = new Map<string, number>();
  let matchedByHost = 0;
  const tallies: Array<{ spec: SheetSpec; t: Tally }> = [];

  for (const spec of targets) {
    const t: Tally = { read: 0, filled: 0, inserted: 0, untouched: 0, skipped: 0, conflicts: 0 };

    let parsed: { rows: SheetRow[]; skipped: string[] };
    try {
      parsed = parseSheetRows(spec, await fetchCsv(spec));
    } catch (e) {
      console.log(`✗ ${spec.label}: FETCH/PARSE FAILED — ${e instanceof Error ? e.message.slice(0, 160) : e}`);
      continue;
    }

    t.read = parsed.rows.length;
    t.skipped = parsed.skipped.length;

    // Collapse repeat applications within a sheet, keeping the LAST — 24 companies
    // applied more than once in szn4 and were scored differently each time.
    //
    // Without this the run is not idempotent under --force: the first occurrence
    // matches, each later duplicate is seen as a conflict and patches the DB forward,
    // and on the next run the first row disagrees again and patches it back. The
    // priorities oscillate between runs forever. Keeping the last occurrence also
    // matches lib/crm/sheet-sync.ts, so the backfill and the live sync agree on which
    // submission is current.
    // Keyed on the RESOLVED TARGET, matching lib/crm/sheet-sync.ts. Collapsing by
    // name (or even by domain) is not enough — "Bella Bread Co." and "Bella Bread
    // Company" are distinct strings that resolve to one deal, so both survive the
    // collapse and then patch each other's priority back and forth on every run.
    // Resolving first and keeping the last row per target is what converges.
    const collapsed = new Map<string, SheetRow>();
    for (const r of parsed.rows) {
      const k = norm(r.company);
      const h = identityHost(r.website, r.contactEmail);
      const m = byName.get(k) ?? (h ? byHost.get(h) : undefined);
      collapsed.set(m ? `id:${m.id ?? k}` : h ?? `name:${k}`, r);
    }
    const sheetRows = [...collapsed.values()];

    if (SAMPLE > 0) {
      console.log(`\n── sample: ${spec.label} ──`);
      for (const r of parsed.rows.slice(0, SAMPLE)) {
        console.log(
          `  company=${JSON.stringify(r.company)} date=${JSON.stringify(r.dateSubmitted)} ` +
            `pri=${r.priority} cat=${JSON.stringify(r.category)}/${JSON.stringify(r.subcategory)}`,
        );
        console.log(`    email=${JSON.stringify(r.contactEmail)} name=${JSON.stringify(r.contactName)} site=${JSON.stringify(r.website)}`);
        console.log(`    message=${JSON.stringify((r.message ?? "").slice(0, 220))}`);
      }
      console.log("");
    }

    for (const row of sheetRows) {
      if (row.rawStage && !row.stage) {
        unknownStages.set(row.rawStage, (unknownStages.get(row.rawStage) ?? 0) + 1);
      }

      const key = norm(row.company);
      const host = identityHost(row.website, row.contactEmail);
      // Name first, then domain — so a website-derived name still finds the deal
      // the CRM already knows under its real spelling.
      const match = byName.get(key) ?? (host ? byHost.get(host) : undefined);
      if (match && host) matchedByHost += byName.has(key) ? 0 : 1;

      // Presence in the index means "this company is already accounted for" —
      // whether it came from the DB or from a sheet processed earlier in this run.
      // Only the *write* below depends on it having a real row id, so a dry run
      // reports repeats as fills rather than inflating the insert count.
      if (match) {
        const cur = match.row;
        const patch: Partial<typeof brandApps.$inferInsert> = {};

        if (row.priority != null) {
          if (cur.priority == null) patch.priority = row.priority;
          else if (cur.priority !== row.priority) {
            t.conflicts++;
            // Name where the kept value came from. A `db` conflict means the sheet
            // disagrees with the CRM; a sheet key means the same company was scored
            // twice — including twice within one season.
            conflictList.push(
              `${row.company}: kept P${cur.priority} (${match.from}) vs P${row.priority} (${spec.key})`,
            );
            if (FORCE) patch.priority = row.priority;
          }
        }
        if (row.stage && !cur.stage?.trim()) patch.stage = row.stage;
        if (row.category && !cur.category) patch.category = row.category;
        if (row.subcategory && !cur.subcategory) patch.subcategory = row.subcategory;
        if (row.website && !cur.website) patch.website = row.website;
        if (row.contactName && !cur.contactName) patch.contactName = row.contactName;
        if (row.contactEmail && !cur.contactEmail) patch.contactEmail = row.contactEmail;
        if (row.message && !cur.message) patch.message = row.message;
        if (row.dateSubmitted && !cur.dateSubmitted) patch.dateSubmitted = row.dateSubmitted;

        if (Object.keys(patch).length === 0) {
          t.untouched++;
          continue;
        }
        t.filled++;
        // Keep the in-memory view current so a later sheet doesn't re-fill the
        // same blank and double-count.
        Object.assign(match.row, patch);
        if (APPLY && match.id) {
          await db.update(brandApps).set(patch).where(eq(brandApps.id, match.id));
        }
      } else {
        t.inserted++;
        const values = {
          company: row.company,
          category: row.category,
          subcategory: row.subcategory,
          source: spec.source,
          priority: row.priority,
          stage: row.stage,
          contactName: row.contactName,
          contactEmail: row.contactEmail,
          message: row.message,
          website: row.website,
          dateSubmitted: row.dateSubmitted,
          archived: row.stage != null && ARCHIVE_STATUSES.includes(row.stage),
        };
        let entry: Entry;
        if (APPLY) {
          const [ins] = await db.insert(brandApps).values(values).returning();
          entry = { id: ins.id, row: ins, from: spec.key };
        } else {
          // Dry run: still index it, so a repeat company in a later sheet is
          // reported as a fill rather than a second insert.
          entry = { id: null, row: values as never, from: spec.key };
        }
        byName.set(key, entry);
        if (host && !byHost.has(host)) byHost.set(host, entry);
      }
    }

    tallies.push({ spec, t });
    if (parsed.skipped.length) {
      console.log(`  ⚠ ${spec.key}: skipped ${parsed.skipped.length} row(s) with no derivable company:`);
      for (const s of parsed.skipped.slice(0, 5)) console.log(`      ${s}`);
      if (parsed.skipped.length > 5) console.log(`      …and ${parsed.skipped.length - 5} more`);
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(78)}`);
  console.log(
    `${"sheet".padEnd(12)}${"read".padStart(7)}${"insert".padStart(8)}${"fill".padStart(7)}` +
      `${"same".padStart(7)}${"skip".padStart(7)}${"conflict".padStart(10)}`,
  );
  const sum: Tally = { read: 0, filled: 0, inserted: 0, untouched: 0, skipped: 0, conflicts: 0 };
  for (const { spec, t } of tallies) {
    console.log(
      `${spec.key.padEnd(12)}${String(t.read).padStart(7)}${String(t.inserted).padStart(8)}` +
        `${String(t.filled).padStart(7)}${String(t.untouched).padStart(7)}` +
        `${String(t.skipped).padStart(7)}${String(t.conflicts).padStart(10)}`,
    );
    for (const k of Object.keys(sum) as (keyof Tally)[]) sum[k] += t[k];
  }
  console.log(`${"─".repeat(78)}`);
  console.log(
    `${"TOTAL".padEnd(12)}${String(sum.read).padStart(7)}${String(sum.inserted).padStart(8)}` +
      `${String(sum.filled).padStart(7)}${String(sum.untouched).padStart(7)}` +
      `${String(sum.skipped).padStart(7)}${String(sum.conflicts).padStart(10)}`,
  );

  if (matchedByHost) {
    console.log(
      `\nMatched by domain rather than name: ${matchedByHost} ` +
        `(these would otherwise have been inserted as duplicates)`,
    );
  }
  if (conflictList.length) {
    console.log(
      `\nPriority conflicts (${FORCE ? "OVERWRITTEN via --force" : "kept DB value; rerun with --force for sheet"}): ${conflictList.length}`,
    );
    for (const c of conflictList.slice(0, 30)) console.log(`  · ${c}`);
    if (conflictList.length > 30) console.log(`  · …and ${conflictList.length - 30} more`);
  }
  if (unknownStages.size) {
    console.log(
      "\nUnmapped sheet stages (left null): " +
        [...unknownStages.entries()].map(([s, n]) => `"${s}"×${n}`).join(", "),
    );
  }

  if (APPLY) {
    const after = await db.select().from(brandApps);
    const withPri = after.filter((r) => r.priority != null).length;
    const withStage = after.filter((r) => r.stage?.trim()).length;
    console.log(
      `\nbrand_app rows after: ${after.length} ` +
        `(${withPri} rated, ${after.length - withPri} unrated; ${withStage} staged, ${after.length - withStage} unstaged)`,
    );
  } else if (OFFLINE) {
    console.log(
      `\nOffline parse — Postgres never contacted. "insert" above is the count of ` +
        `distinct companies across all sheets, not what would land in a live DB.`,
    );
  } else {
    console.log(`\nDry run — nothing written. Re-run with --apply to commit.`);
  }

  if (!OFFLINE) await pool.end();
}

main().catch((e) => {
  console.error("Import failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
