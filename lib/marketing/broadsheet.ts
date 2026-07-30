// The public homepage broadsheet ("the site IS the newspaper"). Every story
// is real content re-typeset as newspaper articles; headlines are the site's
// only navigation. Copy is drawn from investmentFeatures/heroSlides/about —
// no invented fund facts.

import { INVESTMENTS } from "./investmentFeatures";
import { EVENTS_RECAP_URL, HERO_SLIDES } from "./heroSlides";

export type BroadsheetStory = {
  id: string;
  headline: string;
  deck?: string;
  body: string[];
  href: string;
  external?: boolean;
  cut?: { src: string; caption: string };
  xref?: { label: string; href: string; external?: boolean };
};

const [maxines, seatopia, ripi] = INVESTMENTS;
const newsletter = HERO_SLIDES.find((s) => s.id === "newsletter");
const events = HERO_SLIDES.find((s) => s.id === "events");

// Lead story — the fund itself (copy from the About page prose).
export const LEAD_STORY: BroadsheetStory = {
  id: "the-desk",
  headline: "Paperboy Backs the Breakout Pantry",
  deck: "A consumer-focused investment desk — more newsroom than institution.",
  body: [
    "Paperboy Ventures backs breakout food brands — from better-for-you cookies to regenerative seafood to chef-crafted pasta — at the moment they are ready to move from cult favorite to household name.",
    `Out of Fund I, the desk has backed ${maxines.brand}, ${seatopia.brand}, and ${ripi.brand}: founders with a hero product, real substance behind the label, and a story worth printing on the front page.`,
    "When the desk takes a position, it works the story with the founder: distribution, brand, and the long grind of earning a permanent place on the shelf.",
  ],
  href: "/portfolio",
  cut: { src: "/front-page/cuts/maxines.jpg", caption: `${maxines.brand} · Fund I` },
  xref: { label: "See the full portfolio →", href: "/portfolio" },
};

// Second row — the other two holdings plus DEALS.
export const COLUMN_STORIES: BroadsheetStory[] = [
  {
    id: seatopia.id,
    headline: "Seatopia Farms a Cleaner Catch",
    deck: seatopia.sector,
    body: [seatopia.thesis],
    href: "/portfolio",
    cut: { src: "/front-page/cuts/seatopia.jpg", caption: `${seatopia.brand} · Fund I` },
  },
  {
    id: ripi.id,
    headline: "Ripi Puts Restaurant Ravioli on Ice",
    deck: ripi.sector,
    body: [ripi.thesis],
    href: "/portfolio",
    cut: { src: "/front-page/cuts/ripi.jpg", caption: `${ripi.brand} · Fund I` },
  },
  {
    id: "deals",
    headline: "DEALS: The Newsletter, Szn 4 Now Live",
    deck: newsletter?.sector,
    body: [newsletter?.thesis ?? ""],
    href: "/deals",
    cut: { src: "/front-page/cuts/deals.jpg", caption: "Delivered by the Paperboy desk" },
    xref: { label: "Subscribe on the DEALS page →", href: "/deals" },
  },
];

// Front-page classifieds strip: small boxed notices that route to the
// apply / jobs / deals pages (headlines-as-nav needs these discoverable).
export const CLASSIFIEDS = [
  { kicker: "Notices", line: "Founders Wanted — Apply to the Desk", href: "/apply" },
  { kicker: "Situations", line: "The Best Roles in CPG", href: "/jobs" },
  { kicker: "Subscriptions", line: "DEALS — Finely Curated, Szn 4", href: "/deals" },
] as const;

// Bottom row — events and the publisher.
export const FOOT_STORIES: BroadsheetStory[] = [
  {
    id: "invitational",
    headline: "The Invitational Gathers the Category",
    deck: events?.sector,
    body: [events?.thesis ?? ""],
    href: EVENTS_RECAP_URL,
    external: true,
    xref: { label: "See the recap →", href: EVENTS_RECAP_URL, external: true },
  },
  {
    id: "publisher",
    headline: "From the Publisher",
    deck: "Kyle Fitzpatrick · Paperboy Ventures",
    body: [
      "We keep the operation deliberately small. Founders and LPs — write the desk, or step through the Members' Entrance above.",
    ],
    href: "/about",
    cut: { src: "/team/kyle-hedcut-1.png", caption: "The Publisher" },
    xref: { label: "Meet the masthead →", href: "/about" },
  },
];
