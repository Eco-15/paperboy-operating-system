import { and, asc, eq, like, notLike } from "drizzle-orm";
import { db } from "@/lib/db";
import { driveFiles, docChunks } from "@/lib/db/schema";

// The knowledge brain (jobs/knowledge-builder) writes two kinds of synthetic doc:
//   card:<brand>            — a factual card per portfolio brand      (source: brand_card)
//   card:_template:<key>    — a "Template & Style Guide" per doc type (source: template)
// Neither stores its body as a column: the markdown only exists as `doc_chunk` rows.
// So reading one back means re-stitching the chunks, which were sliced with a ~150-char
// overlap.

/** Re-assemble a card's markdown from its overlapping chunks. */
export function mergeChunks(parts: string[]): string {
  if (parts.length === 0) return "";
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const next = parts[i];
    const max = Math.min(out.length, next.length, 400);
    let overlap = 0;
    for (let k = max; k >= 12; k--) {
      if (out.slice(out.length - k) === next.slice(0, k)) {
        overlap = k;
        break;
      }
    }
    out += overlap > 0 ? next.slice(overlap) : "\n\n" + next;
  }
  return out;
}

/** The doc types the knowledge builder produces style guides for. */
export const TEMPLATE_KEYS = [
  "investment-memo",
  "investor-deck",
  "deals-episode",
  "advisory-agreement",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export interface Card {
  id: string;
  title: string;
  body: string;
}

/** Load one synthetic card by its full drive_file_id (e.g. `card:_template:investor-deck`). */
export async function getCard(driveFileId: string): Promise<Card | null> {
  const [file] = await db
    .select({ id: driveFiles.driveFileId, title: driveFiles.title, name: driveFiles.name })
    .from(driveFiles)
    .where(eq(driveFiles.driveFileId, driveFileId))
    .limit(1);
  if (!file) return null;

  const rows = await db
    .select({ content: docChunks.content })
    .from(docChunks)
    .where(eq(docChunks.driveFileId, driveFileId))
    .orderBy(asc(docChunks.chunkIndex));
  if (!rows.length) return null;

  return {
    id: file.id,
    title: file.title ?? file.name,
    body: mergeChunks(rows.map((r) => r.content)),
  };
}

/** The house style guide for a doc type, or null if the builder hasn't made one yet. */
export function getTemplate(key: string): Promise<Card | null> {
  return getCard(`card:_template:${key}`);
}

/** Which style guides actually exist right now (the builder may have skipped some). */
export async function listTemplates(): Promise<{ key: string; title: string }[]> {
  const rows = await db
    .select({ id: driveFiles.driveFileId, title: driveFiles.title, name: driveFiles.name })
    .from(driveFiles)
    .where(and(like(driveFiles.driveFileId, "card:_template:%")))
    .orderBy(asc(driveFiles.name));
  return rows.map((r) => ({
    key: r.id.replace("card:_template:", ""),
    title: r.title ?? r.name,
  }));
}

// Brand-card matching normalizer — same rules the Brand Library used, so the
// deal page finds exactly the cards the old /brands tab showed.
const cleanCardName = (s: string) => s.replace(/\s*[—-]\s*Brand Card\s*$/i, "").trim();
const normName = (s: string) => cleanCardName(s).toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The brand card for a company, by normalized name (freshest generation wins).
 * This is the Brand Library folded into the CRM: each deal page carries its
 * brand file instead of a separate library tab.
 */
export async function getBrandCard(company: string): Promise<Card | null> {
  const key = normName(company);
  if (!key) return null;

  const rows = await db
    .select({
      id: driveFiles.driveFileId,
      title: driveFiles.title,
      name: driveFiles.name,
      updatedAt: driveFiles.lastSyncedAt,
    })
    .from(driveFiles)
    .where(and(like(driveFiles.driveFileId, "card:%"), notLike(driveFiles.driveFileId, "card:_template:%")));

  let best: (typeof rows)[number] | null = null;
  for (const r of rows) {
    if (normName(r.title ?? r.name) !== key) continue;
    if (!best || (r.updatedAt?.getTime() ?? 0) > (best.updatedAt?.getTime() ?? 0)) best = r;
  }
  return best ? getCard(best.id) : null;
}
