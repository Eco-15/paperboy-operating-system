import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { brandApps } from "@/lib/db/schema";
import { getDriveClient } from "@/lib/rag/drive";
import { sheetByKey } from "./sheets";
import { parseSheetRows, norm, identityHost, type SheetRow } from "./sheet-rows";

// Keeps brand_app mirroring the szn4 brand-application sheet, which is the system of
// record for the Investment CRM: Squarespace's form blocks write into it, and the CRM
// reflects it.
//
// THE INVARIANT: the sync is field-scoped, never a row-level mirror. The sheet has 15
// columns and none of them are Stage, Fund or Archived — those live only in Postgres
// and are what the CRM's kanban board runs on. Writing a whole row from the sheet
// would wipe the pipeline state on every pull. Only SHEET_OWNED below is ever written.

const SHEET_KEY = "szn4";

/**
 * Columns the sheet is authoritative for. Everything absent from this list —
 * `stage`, `fund`, `archived`, `aiOnePager` — belongs to the CRM and must never
 * appear in an update built by this module.
 */
const SHEET_OWNED = [
  "company",
  "contactName",
  "contactEmail",
  "website",
  "message",
  "priority",
  "category",
  "subcategory",
  "dateSubmitted",
] as const;

export interface SyncResult {
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
  /** Rows matched on domain rather than name — duplicates that were avoided. */
  matchedByHost: number;
  /**
   * Companies newly inserted by this run, in sheet order. The push notifier
   * names them, so an alert reads "Fernbrook Kitchen, Nine Bar" rather than
   * "2 new applications".
   */
  insertedCompanies: string[];
  /** Ids of those rows, for deep-linking straight into a deal. */
  insertedIds: string[];
}

export const EMPTY_SYNC: SyncResult = {
  inserted: 0,
  updated: 0,
  unchanged: 0,
  skipped: 0,
  matchedByHost: 0,
  insertedCompanies: [],
  insertedIds: [],
};

async function fetchSheetCsv(fileId: string): Promise<string> {
  const drive = getDriveClient();
  const res = await drive.files.export(
    { fileId, mimeType: "text/csv" },
    { responseType: "text" },
  );
  return String(res.data);
}

/** The sheet-owned patch for an existing row — only fields that actually differ. */
function diffPatch(
  row: SheetRow,
  current: typeof brandApps.$inferSelect,
): Partial<typeof brandApps.$inferInsert> {
  const patch: Partial<typeof brandApps.$inferInsert> = {};
  for (const key of SHEET_OWNED) {
    const next = row[key];
    // A blank cell means "not filled in", not "clear the CRM value" — a founder
    // leaving Website empty on a re-application shouldn't erase the known URL.
    if (next == null || next === "") continue;
    if (current[key] !== next) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (patch as any)[key] = next;
    }
  }
  return patch;
}

/**
 * Pull the szn4 sheet and reconcile it into brand_app.
 *
 * Throws if Drive is unreachable — callers on a read path must catch and fall back to
 * whatever is already in Postgres.
 */
export async function syncBrandAppsFromSheet(): Promise<SyncResult> {
  const spec = sheetByKey(SHEET_KEY);
  if (!spec) throw new Error(`No sheet registered under key "${SHEET_KEY}"`);

  const { rows, skipped } = parseSheetRows(spec, await fetchSheetCsv(spec.fileId));

  const existing = await db.select().from(brandApps);
  type Entry = { id: string; row: typeof brandApps.$inferSelect };
  const byName = new Map<string, Entry>();
  const byHost = new Map<string, Entry>();
  for (const row of existing) {
    const entry: Entry = { id: row.id, row };
    const key = norm(row.company);
    if (key && !byName.has(key)) byName.set(key, entry);
    const host = identityHost(row.website, row.contactEmail);
    if (host && !byHost.has(host)) byHost.set(host, entry);
  }

  // Resolve every row to the deal it targets, THEN keep only the last row per target.
  //
  // Last-wins because a company that re-applies is telling us something newer: 24
  // companies applied more than once within szn4 and were scored differently each time.
  //
  // Keying on the RESOLVED TARGET rather than the company name is what makes the sync
  // converge. Two rows can carry different names and still be the same deal — "Bella
  // Bread Co." and "Bella Bread Company" resolve to one record through the domain
  // index. Deduping by name leaves both alive, each overwriting the other's priority
  // on every pull, so the sync would rewrite those rows every 60 seconds forever.
  type Plan = { row: SheetRow; match?: Entry; host: string | null; viaHost: boolean };
  const planned = new Map<string, Plan>();
  for (const row of rows) {
    const key = norm(row.company);
    const host = identityHost(row.website, row.contactEmail);
    const nameHit = byName.get(key);
    const match = nameHit ?? (host ? byHost.get(host) : undefined);
    // Existing deal → key by its id. New company → key by domain, else by name, so
    // two spellings of the same unknown brand still collapse into one insert.
    const target = match ? `id:${match.id}` : host ?? `name:${key}`;
    planned.set(target, { row, match, host, viaHost: Boolean(match && !nameHit) });
  }

  // Fresh arrays, NOT the ones on EMPTY_SYNC — a spread copies those by
  // reference, so pushing into them would accumulate across every sync call.
  const result: SyncResult = {
    ...EMPTY_SYNC,
    skipped: skipped.length,
    insertedCompanies: [],
    insertedIds: [],
  };

  for (const { row, match, host, viaHost } of planned.values()) {
    const key = norm(row.company);
    if (viaHost) result.matchedByHost++;

    if (match) {
      const patch = diffPatch(row, match.row);
      if (Object.keys(patch).length === 0) {
        result.unchanged++;
        continue;
      }
      const [updated] = await db
        .update(brandApps)
        .set(patch)
        .where(eq(brandApps.id, match.id))
        .returning();
      if (updated) {
        // Keep the in-memory view current so both indexes stay accurate.
        match.row = updated;
      }
      result.updated++;
      continue;
    }

    // New application. `stage` is left null so it renders as "New" in the CRM
    // (lib/crm/map.ts), and archived defaults false — the CRM owns both from here on.
    const [inserted] = await db
      .insert(brandApps)
      .values({
        company: row.company,
        category: row.category,
        subcategory: row.subcategory,
        source: spec.source,
        priority: row.priority,
        stage: null,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        message: row.message,
        website: row.website,
        dateSubmitted: row.dateSubmitted,
        archived: false,
      })
      .returning();

    if (inserted) {
      const entry: Entry = { id: inserted.id, row: inserted };
      byName.set(key, entry);
      if (host && !byHost.has(host)) byHost.set(host, entry);
      result.insertedCompanies.push(inserted.company);
      result.insertedIds.push(inserted.id);
    }
    result.inserted++;
  }

  return result;
}
