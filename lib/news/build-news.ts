import { and, eq, gte, ne } from "drizzle-orm";
import { db } from "../db";
import { newsItems } from "../db/schema";
import { exaSearch, type ExaResult } from "./exa";
import { NEWS_QUERIES, NEWS_LOOKBACK_DAYS, NEWS_TOP_N } from "./prompt";

export type BuiltNewsItem = {
  title: string;
  url: string;
  source: string | null;
  summary: string | null;
  whyItMatters: string | null;
  category: string | null;
  imageUrl: string | null;
  rank: number;
};

// Edition key for "today" in the office timezone — the loop runs on UTC cron,
// so this keeps a 6am ET run from being stamped with tomorrow's date.
export function todayEdition(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function dateOf(r: ExaResult): number {
  const t = r.publishedDate ? Date.parse(r.publishedDate) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

// Crude same-story detector: different outlets covering one event share most of
// their headline words ("Naturis Cosmetics raises Rs 100 crore…" twice). No LLM —
// token overlap against every already-picked title.
function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

function looksLikeDuplicate(title: string, picked: Set<string>[]): boolean {
  const t = titleTokens(title);
  if (t.size === 0) return false;
  return picked.some((p) => {
    let overlap = 0;
    for (const w of t) if (p.has(w)) overlap++;
    return overlap / Math.min(t.size, p.size) >= 0.5;
  });
}

// Pure Exa, no LLM: run every query, dedupe, then round-robin across the query
// buckets (each newest-first) so one topic can't crowd out the rest, and
// present the final pick newest-first. Summaries come from Exa's own
// `contents.summary`.
export async function buildNews(
  edition: string,
  topN = NEWS_TOP_N,
): Promise<BuiltNewsItem[]> {
  const buckets: { tag: string; results: ExaResult[] }[] = [];
  for (const { query, tag } of NEWS_QUERIES) {
    try {
      const results = await exaSearch(query, {
        numResults: 10,
        days: NEWS_LOOKBACK_DAYS,
      });
      buckets.push({ tag, results: results.sort((a, b) => dateOf(b) - dateOf(a)) });
    } catch (e) {
      console.error(`[news] Exa query failed: ${query}`, (e as Error).message);
    }
  }

  // dedupe by URL — within this run AND against stories published in OTHER
  // editions, so consecutive daily papers don't repeat each other (the Exa
  // lookback window is wider than one day on purpose). Today's own edition is
  // exempt, so a same-day manual refresh can re-pick the same stories.
  const cutoff = new Date(Date.now() - 14 * 86400000);
  const published = await db
    .select({ url: newsItems.url })
    .from(newsItems)
    .where(and(gte(newsItems.createdAt, cutoff), ne(newsItems.edition, edition)));
  const seen = new Set<string>(published.map((r) => r.url));

  const picked: { tag: string; r: ExaResult }[] = [];
  const pickedTitles: Set<string>[] = [];
  const maxLen = Math.max(0, ...buckets.map((b) => b.results.length));
  for (let i = 0; i < maxLen && picked.length < topN; i++) {
    for (const b of buckets) {
      if (picked.length >= topN) break;
      const r = b.results[i];
      if (!r?.url || !r.title || seen.has(r.url)) continue;
      seen.add(r.url);
      if (looksLikeDuplicate(r.title, pickedTitles)) continue;
      pickedTitles.push(titleTokens(r.title));
      picked.push({ tag: b.tag, r });
    }
  }

  return picked
    .sort((a, b) => dateOf(b.r) - dateOf(a.r))
    .map(({ tag, r }, i) => ({
      title: r.title,
      url: r.url,
      source: hostOf(r.url),
      summary: r.summary?.trim() || null,
      whyItMatters: null,
      category: tag,
      imageUrl: r.image?.startsWith("http") ? r.image : null,
      rank: i + 1,
    }));
}

// Write one day's edition, atomically: re-running a day replaces only that
// day's stories; every other edition stays put as the archive.
export async function saveNews(
  items: BuiltNewsItem[],
  batchId: string,
  edition: string,
): Promise<void> {
  if (items.length === 0) return;
  await db.transaction(async (tx) => {
    await tx.delete(newsItems).where(eq(newsItems.edition, edition));
    await tx.insert(newsItems).values(items.map((it) => ({ ...it, batchId, edition })));
  });
}
