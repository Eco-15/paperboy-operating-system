// Slides for the public homepage hero: the three Fund I investments plus the
// DEALS newsletter and Paperboy events. The /login hero cycles INVESTMENTS
// directly; this list is only for the marketing site.

import { INVESTMENTS } from "./investmentFeatures";

export type HeroSlide = {
  id: string;
  kicker: string;
  brand: string;
  sector: string;
  thesis: string;
  tint?: string;
  cta: { label: string; href: string; external?: boolean };
};

export const EVENTS_RECAP_URL =
  "https://www.linkedin.com/posts/kylefitzpat_i-dont-even-know-what-to-say-three-days-activity-7441899527751655424-ueC-";

export const DEALS_URL = "https://www.paperboyventures.com/deals";

export const HERO_SLIDES: HeroSlide[] = [
  ...INVESTMENTS.map((inv) => ({
    id: inv.id,
    kicker: `Now backing · ${inv.tag}`,
    brand: inv.brand,
    sector: inv.sector,
    thesis: inv.thesis,
    tint: inv.tint,
    cta: { label: "See the portfolio →", href: "/portfolio" },
  })),
  {
    id: "newsletter",
    kicker: "The Newsletter · Szn 4 Now Live",
    brand: "DEALS",
    sector: "Finely curated early-stage deals",
    thesis:
      "Seed-stage CPG brands under $25M with product in market — food & beverage first, delivered to investors tracking the category.",
    tint: "#e7e0d2",
    cta: { label: "Read DEALS →", href: DEALS_URL, external: true },
  },
  {
    id: "events",
    kicker: "Paperboy Events",
    brand: "The Invitational",
    sector: "Founders · Investors · Products",
    thesis:
      "Our first live event brought CPG founders and investors together over standout products. The next edition arrives this fall.",
    tint: "#e2dbc9",
    cta: { label: "See the recap →", href: EVENTS_RECAP_URL, external: true },
  },
];
