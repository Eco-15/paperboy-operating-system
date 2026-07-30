import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import {
  events,
  eventPairings,
  eventRsvps,
  eventScores,
  eventSponsors,
} from "./schema";

// Demo data for the Fall 2026 Paperboy Invitational — Golf Party. Idempotent:
// if the 'golf-party' slug already exists it exits without writing, so it's
// safe to re-run. Run with `npx tsx lib/db/seed-golf.ts`.

const DESCRIPTION = [
  "The Invitational returns. After the spring poker night packed the room with 175 of the best founders and investors in consumer, the Paperboy Invitational moves outdoors — a full afternoon of scramble golf, followed by drinks, dinner, and the introductions that actually go somewhere.",
  "Expect the same room, different grass: CPG founders paired with the investors who back them, four to a cart, eighteen holes to get past the small talk. Not a golfer? Come for the nineteenth hole — the networking is the tournament.",
  "As with the spring event, a portion of every sponsorship goes to charity. Date and venue land soon; RSVP now and you'll be the first to know.",
].join("\n\n");

async function main() {
  const [existing] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, "golf-party"))
    .limit(1);
  if (existing) {
    console.log("Event 'golf-party' already seeded — nothing to do.");
    await pool.end();
    return;
  }

  console.log("Seeding the Golf Party…");
  const [event] = await db
    .insert(events)
    .values({
      slug: "golf-party",
      name: "Paperboy Invitational — Golf Party",
      date: null, // Fall 2026 — TBA
      venue: "TBA",
      description: DESCRIPTION,
      format: "golf",
      status: "live",
    })
    .returning();

  // ── Foursomes (two groups already built, with tee times) ──
  const [group1] = await db
    .insert(eventPairings)
    .values({ eventId: event.id, groupNumber: 1, teeTime: "9:00 AM" })
    .returning();
  const [group2] = await db
    .insert(eventPairings)
    .values({ eventId: event.id, groupNumber: 2, teeTime: "9:10 AM" })
    .returning();

  // ── RSVPs — the spring event's network ──
  type Seed = {
    name: string;
    email: string;
    company: string;
    role: string;
    status: string;
    wantsToPlay?: boolean;
    pairingId?: string;
    message?: string;
  };
  const guests: Seed[] = [
    {
      name: "Jim Cummings",
      email: "jim@pelorus.vc",
      company: "Pelorus",
      role: "Investor",
      status: "approved_player",
      wantsToPlay: true,
      pairingId: group1.id,
    },
    {
      name: "Matt Gorin",
      email: "matt@contourventures.com",
      company: "Contour Ventures",
      role: "Investor",
      status: "approved_player",
      wantsToPlay: true,
      pairingId: group1.id,
      message: "Loved the poker night. Calling my shot now: under par or the drinks are on me.",
    },
    {
      name: "Ronak Shah",
      email: "ronak@myobvi.com",
      company: "Obvi",
      role: "Founder",
      status: "approved_player",
      wantsToPlay: true,
      pairingId: group1.id,
    },
    {
      name: "Kelley Arena",
      email: "kelley@goldenhour.vc",
      company: "Golden Hour Ventures",
      role: "Investor",
      status: "approved_player",
      wantsToPlay: true,
      pairingId: group1.id,
    },
    {
      name: "Greg Kammerer",
      email: "greg@61holdings.com",
      company: "61 Holdings",
      role: "Investor",
      status: "approved_player",
      wantsToPlay: true,
      pairingId: group2.id,
    },
    {
      name: "Chris Robb",
      email: "chris@theangelgroup.com",
      company: "The Angel Group",
      role: "Investor",
      status: "approved_player",
      wantsToPlay: true,
      pairingId: group2.id,
    },
    {
      name: "Robert Andreozzi",
      email: "robert@pizzawine.com",
      company: "Pizza Wine",
      role: "Founder",
      status: "approved_player",
      wantsToPlay: true,
      pairingId: group2.id,
      message: "Bringing a few bottles for the nineteenth hole.",
    },
    {
      name: "Susie Bittker",
      email: "susie@siddhicapital.com",
      company: "Siddhi Capital",
      role: "Investor",
      status: "approved",
    },
    {
      name: "Erin Anderson",
      email: "erin@mannatreepartners.com",
      company: "Manna Tree Partners",
      role: "Investor",
      status: "approved",
    },
    {
      name: "Brett Jacobs",
      email: "brett@bowerybrands.com",
      company: "Bowery Brands",
      role: "Founder",
      status: "waitlist",
      wantsToPlay: true,
      message: "Happy to fill in if a foursome comes up short.",
    },
    {
      name: "Sivan Gompers",
      email: "sivan@squaredcircles.com",
      company: "Squared Circles",
      role: "Investor",
      status: "pending",
    },
    {
      name: "Annie Evans",
      email: "annie@dreamventures.com",
      company: "Dream Ventures",
      role: "Investor",
      status: "pending",
    },
  ];

  await db.insert(eventRsvps).values(
    guests.map((g) => ({
      eventId: event.id,
      name: g.name,
      email: g.email,
      company: g.company,
      role: g.role,
      status: g.status,
      wantsToPlay: g.wantsToPlay ?? false,
      pairingId: g.pairingId ?? null,
      message: g.message ?? null,
    })),
  );
  console.log(`  ${guests.length} RSVPs`);

  // ── Group 1 is five holes in (−2 through 5, scramble) ──
  const holes: { hole: number; strokes: number }[] = [
    { hole: 1, strokes: 4 }, // par 4
    { hole: 2, strokes: 4 }, // par 4
    { hole: 3, strokes: 2 }, // par 3 — birdie
    { hole: 4, strokes: 4 }, // par 5 — eagle territory
    { hole: 5, strokes: 4 }, // par 4
  ];
  await db.insert(eventScores).values(
    holes.map((h) => ({
      eventId: event.id,
      pairingId: group1.id,
      hole: h.hole,
      strokes: h.strokes,
    })),
  );
  console.log(`  Group 1 scored through ${holes.length} holes`);

  // ── Sponsors: the open title slot + Doss (back from the spring event) ──
  await db.insert(eventSponsors).values([
    {
      eventId: event.id,
      company: "Open",
      tier: "title",
      amount: 20000,
      deliverables: [],
    },
    {
      eventId: event.id,
      company: "Doss",
      tier: "secondary",
      amount: 8000,
      contactName: "Partnerships",
      contactEmail: "partners@doss.com",
      deliverables: [
        { label: "5 guaranteed intros", done: false },
        { label: "Logo on signage", done: true },
        { label: "Gift bag placement", done: true },
        { label: "Recap deck logo", done: false },
        { label: "4 guest passes", done: false },
      ],
    },
  ]);
  console.log("  2 sponsor slots");

  console.log("Done — the console is at /events, the public page at /events/golf-party.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
