import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { events, eventSponsors } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { sponsorToRec } from "@/lib/events/map";
import { SPONSOR_TIERS } from "@/lib/events/types";

// Add a sponsor slot to an event. Staff-only.
const createSchema = z.object({
  company: z.string().trim().min(1).max(200),
  tier: z.enum(SPONSOR_TIERS as [string, ...string[]]).optional(),
  amount: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  contactName: z.string().trim().max(200).optional(),
  contactEmail: z.string().trim().email().max(320).optional().or(z.literal("")),
  deliverables: z
    .array(z.object({ label: z.string().trim().min(1).max(300), done: z.boolean() }))
    .max(30)
    .optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, id))
    .limit(1);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  const [row] = await db
    .insert(eventSponsors)
    .values({
      eventId: id,
      company: d.company,
      tier: d.tier ?? null,
      amount: d.amount ?? null,
      contactName: d.contactName || null,
      contactEmail: d.contactEmail || null,
      deliverables: d.deliverables ?? [],
    })
    .returning();

  return NextResponse.json({ sponsor: sponsorToRec(row) }, { status: 201 });
}
