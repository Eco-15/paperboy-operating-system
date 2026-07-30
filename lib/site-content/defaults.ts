// Static defaults for every editable public page — a snapshot of the site as
// it ships in code. The DB is lazily seeded from these: public pages render
// `published ?? default`, the editor opens `draft ?? default`, so with no
// site_page rows the site is byte-identical to the pre-editor build.

import {
  LEAD_STORY,
  COLUMN_STORIES,
  FOOT_STORIES,
  CLASSIFIEDS,
} from "@/lib/marketing/broadsheet";
import { INVESTMENTS } from "@/lib/marketing/investmentFeatures";
import type {
  AboutContent,
  ApplyContent,
  DealsContent,
  HomeContent,
  JobsContent,
  PortfolioContent,
  SitePageContent,
  SitePageSlug,
} from "./schema";

export const HOME_DEFAULT: HomeContent = {
  classifieds: CLASSIFIEDS.map((c) => ({ ...c })),
  lead: LEAD_STORY,
  columnStories: COLUMN_STORIES,
  footStories: FOOT_STORIES,
};

export const ABOUT_DEFAULT: AboutContent = {
  title: "About Paperboy Ventures",
  byline: "An editorial from the desk",
  paragraphs: [
    "Paperboy Ventures is a consumer-focused investment desk. We back breakout food brands — from better-for-you cookies to regenerative seafood to chef-crafted pasta — at the moment they are ready to move from cult favorite to household name.",
    "Out of Fund I, the desk has backed Maxine's Heavenly, Seatopia, and Ripi: founders with a hero product, real substance behind the label, and a story worth printing on the front page.",
    "We keep the operation deliberately small — more newsroom than institution. When we take a position, we work the story with the founder: distribution, brand, and the long grind of earning a permanent place on the shelf.",
  ],
  aside: {
    imageSrc: "/team/kyle-hedcut-1.png",
    imageCaption: "The Publisher",
    name: "Kyle Fitzpatrick",
    role: "Publisher · Paperboy Ventures",
  },
};

export const APPLY_DEFAULT: ApplyContent = {
  title: "Founders Wanted",
  deck: "Apply for content features and/or direct investment via Paperboy Fund I.",
  byline: "The desk reads every application",
  notice: {
    head: "What the desk looks for",
    paragraphs: [
      "Raising seed capital with $25m valuation caps and under. Must have traction with product in-market.",
      "Exceptional quality products. Strong unit economics. Mass market potential. Standout branding. Aggressive team.",
    ],
  },
};

export const JOBS_DEFAULT: JobsContent = {
  title: "The Best Roles in CPG",
  deck: "For operators exploring new opportunities — handpicked and delivered fresh each week.",
  byline: "Curated by the Paperboy desk",
};

// The engraved article cut per holding (moved from app/(site)/portfolio/page.tsx).
const PORTFOLIO_CUTS: Record<string, string> = {
  "maxines-heavenly": "/front-page/cuts/maxines.jpg",
  seatopia: "/front-page/cuts/seatopia.jpg",
  ripi: "/front-page/cuts/ripi.jpg",
};

export const PORTFOLIO_DEFAULT: PortfolioContent = {
  title: "The Portfolio",
  deck: "Breakout consumer brands, backed off the front page.",
  byline: "By The Paperboy Desk · New York",
  cards: INVESTMENTS.map((inv) => ({
    id: inv.id,
    brand: inv.brand,
    sector: inv.sector,
    thesis: inv.thesis,
    tag: inv.tag,
    href: inv.href,
    cutSrc: PORTFOLIO_CUTS[inv.id],
    cutCaption: PORTFOLIO_CUTS[inv.id] ? `${inv.brand} · ${inv.tag}` : undefined,
  })),
};

// Transcribed from app/(site)/deals/page.tsx — the gold "." after the title
// and the PRESS_POSTS archive grid stay in the template.
export const DEALS_DEFAULT: DealsContent = {
  title: "DEALS",
  deck: "Finely curated early-stage deals — for investors tracking startup CPGs.",
  byline: "Delivered by the Paperboy desk",
  notice: {
    head: "The Standard",
    paragraphs: [
      "Raising seed capital with $25m valuation caps and under. Must have traction with product in-market.",
      "Exceptional quality products. Strong unit economics. Mass market potential. Standout branding. Aggressive team.",
    ],
  },
  ledgerHead: "Every Edition · The Back Catalog",
};

// The Sheet chrome each page ships with (also the fallback when content.sheet
// is absent). Kept here so the editor and the public pages share one source.
export const SHEET_DEFAULTS: Record<SitePageSlug, { section: string; kicker: string }> = {
  home: { section: "Front Page", kicker: "Investing in Breakout Consumer Brands" },
  about: { section: "Editorial", kicker: "The Masthead" },
  apply: { section: "Call for Founders", kicker: "Applications · Open Daily" },
  jobs: { section: "Situations", kicker: "The CPG Jobs Desk" },
  portfolio: { section: "Business & Markets", kicker: "Fund I · Current Holdings" },
  deals: { section: "DEALS", kicker: "The Newsletter · Szn 4 Now Live" },
};

export const PAGE_DEFAULTS: { [K in SitePageSlug]: SitePageContent[K] } = {
  home: HOME_DEFAULT,
  about: ABOUT_DEFAULT,
  apply: APPLY_DEFAULT,
  jobs: JOBS_DEFAULT,
  portfolio: PORTFOLIO_DEFAULT,
  deals: DEALS_DEFAULT,
};
