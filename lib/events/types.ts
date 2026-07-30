// Shared shapes for the events module. API responses serialize DB rows into
// these (timestamps become ISO strings) so the OS console and the public RSVP
// page speak one vocabulary.

export type EventStatus = "draft" | "live" | "complete";

export type RsvpStatus =
  | "pending"
  | "approved"
  | "approved_player"
  | "waitlist"
  | "declined";

export const RSVP_STATUSES: RsvpStatus[] = [
  "pending",
  "approved",
  "approved_player",
  "waitlist",
  "declined",
];

// Labels match the spring spreadsheet's hand-typed vocabulary.
export const STATUS_LABEL: Record<RsvpStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  approved_player: "Approved (Player)",
  waitlist: "Wait List",
  declined: "Declined",
};

export const STATUS_COLOR: Record<RsvpStatus, string> = {
  pending: "hsl(35, 62%, 46%)",
  approved: "hsl(150, 32%, 38%)",
  approved_player: "hsl(160, 46%, 28%)",
  waitlist: "hsl(217, 22%, 48%)",
  declined: "hsl(0, 38%, 46%)",
};

export const GUEST_ROLES = ["Investor", "Founder", "Media", "Other"] as const;

export type SponsorTier = "title" | "secondary" | "exhibition";

export const SPONSOR_TIERS: SponsorTier[] = ["title", "secondary", "exhibition"];

export const TIER_LABEL: Record<SponsorTier, string> = {
  title: "Title Sponsor",
  secondary: "Secondary Sponsor",
  exhibition: "Exhibition",
};

// Default asking price per tier (whole dollars) — pre-fills the add modal.
export const TIER_AMOUNT: Record<SponsorTier, number | null> = {
  title: 20000,
  secondary: 8000,
  exhibition: null,
};

export interface Deliverable {
  label: string;
  done: boolean;
}

export interface EventRec {
  id: string;
  slug: string;
  name: string;
  date: string | null; // ISO, null = TBA
  venue: string | null;
  description: string | null;
  format: string | null;
  status: EventStatus;
  createdAt: string;
}

export interface EventCounts {
  total: number;
  pending: number;
  approved: number; // approved + approved_player
  players: number;
  waitlist: number;
  declined: number;
  checkedIn: number;
}

export interface EventListItem extends EventRec {
  counts: EventCounts;
}

export interface RsvpRec {
  id: string;
  eventId: string;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  wantsToPlay: boolean;
  message: string | null;
  status: RsvpStatus;
  pairingId: string | null;
  checkedInAt: string | null;
  createdAt: string;
}

export interface PairingRec {
  id: string;
  eventId: string;
  groupNumber: number;
  teeTime: string | null;
}

export interface ScoreRec {
  id: string;
  pairingId: string;
  hole: number;
  strokes: number;
}

export interface SponsorRec {
  id: string;
  eventId: string;
  company: string;
  tier: SponsorTier | null;
  amount: number | null;
  contactName: string | null;
  contactEmail: string | null;
  deliverables: Deliverable[];
  createdAt: string;
}

export interface EventDetail {
  event: EventRec;
  rsvps: RsvpRec[];
  pairings: PairingRec[];
  scores: ScoreRec[];
  sponsors: SponsorRec[];
}

export function formatEventDate(date: string | null): string {
  if (!date) return "Fall 2026 — date to be announced";
  const t = new Date(date);
  if (Number.isNaN(t.getTime())) return "Date to be announced";
  return t.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatAmount(amount: number | null): string {
  if (amount == null) return "—";
  return `$${amount.toLocaleString("en-US")}`;
}
