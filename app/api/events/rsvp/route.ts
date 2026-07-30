import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { events, eventRsvps } from "@/lib/db/schema";
import {
  email,
  isHoneypotTripped,
  readJson,
  ok,
  badRequest,
} from "@/lib/site/forms";
import { GUEST_ROLES } from "@/lib/events/types";

// PUBLIC RSVP intake from /events/[slug]. Unauthenticated by design — the
// honeypot is the spam gate (same pattern as /apply). Deduped per (event,
// email): re-submitting updates the guest's details but never resets a status
// staff already set, and never creates a second row.

const schema = z.object({
  slug: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  email,
  company: z.string().trim().max(200).optional().default(""),
  role: z.enum(GUEST_ROLES).optional(),
  wantsToPlay: z.boolean().optional().default(false),
  message: z.string().trim().max(2000).optional().default(""),
});

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return badRequest("Invalid request");
  if (isHoneypotTripped(body)) return ok();

  // The coupon checkbox posts "on"/"" — coerce before validating.
  if (typeof body.wantsToPlay === "string") {
    body.wantsToPlay = body.wantsToPlay === "on" || body.wantsToPlay === "true";
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  const a = parsed.data;

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.slug, a.slug))
    .limit(1);
  if (!event) return badRequest("We couldn't find that event.");
  if (event.status === "complete") {
    return badRequest("RSVPs for this event have closed.");
  }

  const guestEmail = a.email.toLowerCase();
  const [existing] = await db
    .select()
    .from(eventRsvps)
    .where(and(eq(eventRsvps.eventId, event.id), eq(eventRsvps.email, guestEmail)))
    .limit(1);

  if (existing) {
    await db
      .update(eventRsvps)
      .set({
        name: a.name,
        company: a.company || null,
        role: a.role ?? existing.role,
        wantsToPlay: a.wantsToPlay,
        message: a.message || existing.message,
      })
      .where(eq(eventRsvps.id, existing.id));
    return ok();
  }

  await db.insert(eventRsvps).values({
    eventId: event.id,
    name: a.name,
    email: guestEmail,
    company: a.company || null,
    role: a.role ?? null,
    wantsToPlay: a.wantsToPlay,
    message: a.message || null,
    status: "pending",
  });

  return ok();
}
