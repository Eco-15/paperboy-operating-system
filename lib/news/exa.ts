// Thin client for the Exa.ai neural search API (exa.ai). Used by the dashboard
// news loop to fetch recent, high-signal articles. NOTE: this is Exa.ai search —
// unrelated to the "Exia" chat provider in lib/chat.

const EXA_SEARCH = "https://api.exa.ai/search";

export type ExaResult = {
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  text?: string;
  summary?: string;
  image?: string; // the article's hero/og:image, when the page has one
};

export async function exaSearch(
  query: string,
  opts: { numResults?: number; days?: number } = {},
): Promise<ExaResult[]> {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error("EXA_API_KEY is not set");

  const { numResults = 8, days = 4 } = opts;
  const startPublishedDate = new Date(Date.now() - days * 86400000).toISOString();

  const res = await fetch(EXA_SEARCH, {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      query,
      type: "auto",
      category: "news",
      numResults,
      startPublishedDate,
      contents: { summary: true, text: { maxCharacters: 1500 } },
    }),
  });

  if (!res.ok) {
    throw new Error(`Exa ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as { results?: ExaResult[] };
  return (data.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    publishedDate: r.publishedDate,
    author: r.author,
    text: r.text,
    summary: r.summary,
    image: r.image,
  }));
}
