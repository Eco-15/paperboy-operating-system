// Dashboard tiles for the Paperboy operating system, grouped into two sections
// (the dashboard renders these as tabs). Real routes navigate; the not-yet-built
// vision tiles keep href "#" and render as non-navigating (see Tile.tsx).

export type Section = "investment" | "content" | "archive";

export interface Tile {
  index: string;
  title: string;
  desc: string;
  stat: string;
  href: string;
  section: Section;
}

export const tiles: Tile[] = [
  // ── Investment ──────────────────────────────────────────────
  {
    index: "01",
    title: "CPG News",
    desc: "The daily paper — AI-curated CPG and consumer-investing news, a fresh edition every morning.",
    stat: "daily",
    href: "/news",
    section: "investment",
  },
  {
    index: "02",
    title: "Investment CRM",
    desc: "Your deal pipeline and inbound applications, in one place instead of scattered across Airtable and email.",
    // These stats are static labels, not counts (see the others) — the live
    // "new since you last looked" number lives in the CRM itself.
    stat: "pipeline",
    href: "/crm",
    section: "investment",
  },
  {
    index: "3b",
    title: "Documents",
    desc: "Memos, decks and models you've written with Paperboy — drafted beside the chat, with full edit history.",
    stat: "drafts",
    href: "/documents",
    section: "investment",
  },
  {
    index: "04",
    title: "Investor Database",
    desc: "460 CPG investors — angel groups, VCs, and family offices. Search, filter, and map them.",
    stat: "460 investors",
    href: "/investors",
    section: "investment",
  },
  {
    index: "05a",
    title: "Events",
    desc: "Run the Invitational end-to-end — RSVPs, approvals, check-in, pairings, live scorecard, sponsors.",
    stat: "golf party",
    href: "/events",
    section: "investment",
  },
  {
    index: "05",
    title: "Poker Tournament",
    desc: "Live vote tally and leaderboard for the Paperboy poker night, with analytics.",
    stat: "live tally",
    href: "/poker",
    section: "archive",
  },

  // ── Talent & Content ────────────────────────────────────────
  {
    index: "06",
    title: "Talent CRM",
    desc: "Your full talent roster and relationships, out of the spreadsheet and into a real CRM.",
    stat: "roster",
    href: "/talent",
    section: "content",
  },
  {
    index: "07",
    title: "Matching",
    desc: "Match talent to the right brands by category, audience, and fit.",
    stat: "engine",
    href: "/coming-soon?feature=Matching",
    section: "content",
  },
  {
    index: "08",
    title: "Content Studio",
    desc: "Draft posts and newsletters in your voice, learned from everything you’ve published.",
    stat: "new draft",
    href: "/coming-soon?feature=Content%20Studio",
    section: "content",
  },
  {
    index: "8b",
    title: "Site Editor",
    desc: "Edit the public paper like Wix — headlines, copy, cuts, and order — then publish.",
    stat: "5 pages",
    href: "/site-editor",
    section: "content",
  },
  {
    index: "09",
    title: "Blog",
    desc: "The Front Page — write and publish posts and DEALS episodes to the Paperboy blog.",
    stat: "front page",
    href: "/blog",
    section: "content",
  },
  {
    index: "10",
    title: "Newsletter",
    desc: "Run your Beehiiv newsletter from here — subscribers, posts and analytics, drafts, and segments.",
    stat: "beehiiv",
    href: "/newsletter",
    section: "archive",
  },
];

export const SECTIONS: { key: Section; label: string }[] = [
  { key: "investment", label: "Investment" },
  { key: "content", label: "Talent & Content" },
  { key: "archive", label: "Archive" },
];

export const tilesBySection = (section: Section) =>
  tiles.filter((t) => t.section === section);
