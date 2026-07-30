import type { BlogPost } from "./types";

// Seeded from the real paperboyventures.com/blog ("The Front Page") so the feed
// looks populated. Images left blank → rendered as on-brand placeholders.
// Only the authored fields — DB defaults fill in the publish-state columns
// (seeded as drafts so they never surface on the public /press pages).
type SeedPost = Pick<BlogPost, "id" | "title" | "category" | "date" | "image" | "body">;

export const SEED_POSTS: SeedPost[] = [
  {
    id: "seed-frontpage",
    title: "The Front Page",
    category: "Guide",
    date: "3/10/26",
    image: "",
    body: "Insights from the front lines of the emerging consumer brand world — what we're seeing, who we're backing, and why.",
  },
  {
    id: "seed-cpg-guide",
    title: "CPG Investor Guide",
    category: "Guide",
    date: "3/10/26",
    image: "",
    body: "A field guide to the angel groups, VCs, and family offices investing in consumer packaged goods.",
  },
  {
    id: "seed-toto",
    title: "DEALS Ep.25 — Toto",
    category: "DEALS",
    date: "6/23/25",
    image: "",
    body: "On this episode of DEALS, the founders of Toto walk us through their raise and what's next.",
  },
  {
    id: "seed-cheddies",
    title: "DEALS Ep.24 — Cheddies",
    category: "DEALS",
    date: "6/3/25",
    image: "",
    body: "Cheddies joins DEALS to break down the cracker category and their growth story.",
  },
  {
    id: "seed-valuations",
    title: "Startup CPG Valuations",
    category: "News",
    date: "5/14/25",
    image: "",
    body: "How early-stage consumer brands are being valued in today's market.",
  },
  {
    id: "seed-culture-pop",
    title: "Culture Pop lands $15m",
    category: "News",
    date: "4/17/25",
    image: "",
    body: "Culture Pop closes a $15m round to scale its functional soda line.",
  },
];
