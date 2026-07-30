import { asc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { newsItems } from "../db/schema";

// Read side of the daily news editions — used by the /news page (server
// component) and the dashboard rail API. Write side is build-news.ts. Past
// editions stay in the DB for dedupe but have no UI (by design).

export type NewsStory = {
  id: string;
  title: string;
  url: string;
  source: string | null;
  summary: string | null;
  whyItMatters: string | null;
  category: string | null;
  imageUrl: string | null;
  rank: number;
};

export type NewsEdition = {
  edition: string; // "YYYY-MM-DD"
  stories: NewsStory[];
};

async function getEdition(edition: string): Promise<NewsEdition | null> {
  const rows = await db
    .select()
    .from(newsItems)
    .where(eq(newsItems.edition, edition))
    .orderBy(asc(newsItems.rank));
  if (rows.length === 0) return null;
  return {
    edition,
    stories: rows.map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      source: r.source,
      summary: r.summary,
      whyItMatters: r.whyItMatters,
      category: r.category,
      imageUrl: r.imageUrl,
      rank: r.rank,
    })),
  };
}

export async function getLatestEdition(): Promise<NewsEdition | null> {
  const [latest] = await db
    .select({ edition: sql<string>`max(${newsItems.edition})` })
    .from(newsItems);
  if (!latest?.edition) return null;
  return getEdition(latest.edition);
}

// "2026-07-16" → "July 16, 2026" (parse as noon UTC so no TZ can shift the day).
export function editionLabel(edition: string): string {
  const d = new Date(`${edition}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return edition;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}
