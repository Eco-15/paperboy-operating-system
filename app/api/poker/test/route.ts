import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pokerVotes } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { findOrCreatePlayer } from "@/lib/poker/server";

const TEST_VOTES = [
  { player: "Ben Zises", company: "SuperAngel.Fund", votes: 14, caster: "Jordan Tepper" },
  { player: "Ben Zises", company: "SuperAngel.Fund", votes: 6, caster: "Jacqueline Sun" },
  { player: "Jack Power", company: "Glimpse", votes: 11, caster: "Lisa Li" },
  { player: "Jack Power", company: "Glimpse", votes: 4, caster: "Brett Alper" },
  { player: "Emily Reeves", company: "Bridge", votes: 9, caster: "Andrew Watman" },
  { player: "David Peikon", company: "Brodo", votes: 8, caster: "Jon Harary" },
  { player: "David Peikon", company: "Brodo", votes: 3, caster: "Ryan Schwartz" },
  { player: "Nishal Kumar", company: "No Days Wasted", votes: 7, caster: "Alex Comisar" },
  { player: "Jesse Konig", company: "Jesse & Ben's", votes: 7, caster: "Mike Chiasson" },
  { player: "Morgan Oliveira", company: "Aegis Capital", votes: 6, caster: "Bill Connors" },
  { player: "George Moulton", company: "Fun Guy", votes: 5, caster: "Andrea Popova" },
  { player: "Kelley Arena", company: "Golden Hour Ventures", votes: 5, caster: "Justin Burke" },
  { player: "Adam Terry", company: "Cantrip", votes: 3, caster: "Marc Brown" },
  { player: "Bill Donahue", company: "Highmont Ventures", votes: 2, caster: "Allen Duoji" },
];

const schema = z.object({ action: z.enum(["seed", "clear"]) });

// Seed/clear demo vote data. Staff only. Seed votes are tagged is_test=true so
// "clear test data" removes only them and leaves real votes intact.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (parsed.data.action === "clear") {
    await db.delete(pokerVotes).where(eq(pokerVotes.isTest, true));
    return NextResponse.json({ ok: true });
  }

  // seed
  for (const s of TEST_VOTES) {
    const player = await findOrCreatePlayer(s.player, s.company);
    await db.insert(pokerVotes).values({
      playerId: player.id,
      delta: s.votes,
      caster: s.caster,
      isTest: true,
    });
  }
  return NextResponse.json({ ok: true });
}
