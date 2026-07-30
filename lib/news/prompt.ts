// The editable brief that drives the news loop. Tweak the queries here to
// change what the daily paper surfaces. Pure Exa — no LLM in the pipeline.

// Exa.ai search queries — each run gathers all of them, dedupes across the set,
// and keeps the newest stories. `tag` becomes the category chip on /news.
export const NEWS_QUERIES: { query: string; tag: string }[] = [
  {
    query: "consumer packaged goods (CPG) brand funding, acquisition, or launch news",
    tag: "CPG Deals",
  },
  {
    query: "emerging food, beverage, and consumer startup news",
    tag: "Startups",
  },
  {
    query: "retail and direct-to-consumer (DTC) brand deals and expansion",
    tag: "Retail & DTC",
  },
  {
    query: "consumer-focused venture capital and private equity investments",
    tag: "Venture",
  },
];

// How many days back Exa should look, and how many stories to keep per edition.
export const NEWS_LOOKBACK_DAYS = 4;
export const NEWS_TOP_N = 12;
