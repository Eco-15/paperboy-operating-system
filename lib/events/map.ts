import type {
  events,
  eventPairings,
  eventRsvps,
  eventScores,
  eventSponsors,
} from "@/lib/db/schema";
import type {
  EventRec,
  EventStatus,
  PairingRec,
  RsvpRec,
  RsvpStatus,
  ScoreRec,
  SponsorRec,
  SponsorTier,
} from "./types";

// DB row → API shape (timestamps to ISO strings). Every route handler maps
// through these so the JSON the UI sees has exactly one shape.

export function eventToRec(row: typeof events.$inferSelect): EventRec {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    date: row.date ? row.date.toISOString() : null,
    venue: row.venue,
    description: row.description,
    format: row.format,
    status: row.status as EventStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

export function rsvpToRec(row: typeof eventRsvps.$inferSelect): RsvpRec {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    email: row.email,
    company: row.company,
    role: row.role,
    wantsToPlay: row.wantsToPlay ?? false,
    message: row.message,
    status: row.status as RsvpStatus,
    pairingId: row.pairingId,
    checkedInAt: row.checkedInAt ? row.checkedInAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function pairingToRec(row: typeof eventPairings.$inferSelect): PairingRec {
  return {
    id: row.id,
    eventId: row.eventId,
    groupNumber: row.groupNumber,
    teeTime: row.teeTime,
  };
}

export function scoreToRec(row: typeof eventScores.$inferSelect): ScoreRec {
  return {
    id: row.id,
    pairingId: row.pairingId,
    hole: row.hole,
    strokes: row.strokes,
  };
}

export function sponsorToRec(row: typeof eventSponsors.$inferSelect): SponsorRec {
  return {
    id: row.id,
    eventId: row.eventId,
    company: row.company,
    tier: row.tier as SponsorTier | null,
    amount: row.amount,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    deliverables: row.deliverables ?? [],
    createdAt: row.createdAt.toISOString(),
  };
}
