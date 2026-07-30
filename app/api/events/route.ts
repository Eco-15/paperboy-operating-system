import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { events, eventRsvps } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { eventToRec } from "@/lib/events/map";
import type { EventCounts } from "@/lib/events/types";

// Events index: every event with its RSVP funnel counts. Staff-only.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [rows, rsvps] = await Promise.all([
    db.select().from(events),
    db
      .select({
        eventId: eventRsvps.eventId,
        status: eventRsvps.status,
        checkedInAt: eventRsvps.checkedInAt,
      })
      .from(eventRsvps),
  ]);

  const counts = new Map<string, EventCounts>();
  for (const r of rsvps) {
    const c = counts.get(r.eventId) ?? {
      total: 0,
      pending: 0,
      approved: 0,
      players: 0,
      waitlist: 0,
      declined: 0,
      checkedIn: 0,
    };
    c.total += 1;
    if (r.status === "pending") c.pending += 1;
    if (r.status === "approved" || r.status === "approved_player") c.approved += 1;
    if (r.status === "approved_player") c.players += 1;
    if (r.status === "waitlist") c.waitlist += 1;
    if (r.status === "declined") c.declined += 1;
    if (r.checkedInAt) c.checkedIn += 1;
    counts.set(r.eventId, c);
  }

  const list = rows
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((row) => ({
      ...eventToRec(row),
      counts: counts.get(row.id) ?? {
        total: 0,
        pending: 0,
        approved: 0,
        players: 0,
        waitlist: 0,
        declined: 0,
        checkedIn: 0,
      },
    }));

  return NextResponse.json({ events: list });
}

// Create an event. Staff-only.
const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and dashes only"),
  date: z.string().datetime().nullable().optional(),
  venue: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  format: z.string().trim().max(50).optional(),
  status: z.enum(["draft", "live", "complete"]).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  const [existing] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, d.slug))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: "That slug is taken" }, { status: 409 });
  }

  const [row] = await db
    .insert(events)
    .values({
      name: d.name,
      slug: d.slug,
      date: d.date ? new Date(d.date) : null,
      venue: d.venue || null,
      description: d.description || null,
      format: d.format || null,
      status: d.status ?? "draft",
    })
    .returning();

  return NextResponse.json({ event: eventToRec(row) }, { status: 201 });
}
