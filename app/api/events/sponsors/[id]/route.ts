import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { eventSponsors } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { sponsorToRec } from "@/lib/events/map";
import { SPONSOR_TIERS } from "@/lib/events/types";

// Update a sponsor — including toggling deliverable done flags (the client
// sends the whole deliverables array back). Staff-only.
const patchSchema = z.object({
  company: z.string().trim().min(1).max(200).optional(),
  tier: z.enum(SPONSOR_TIERS as [string, ...string[]]).nullable().optional(),
  amount: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  contactName: z.string().trim().max(200).nullable().optional(),
  contactEmail: z
    .string()
    .trim()
    .email()
    .max(320)
    .nullable()
    .optional()
    .or(z.literal("")),
  deliverables: z
    .array(z.object({ label: z.string().trim().min(1).max(300), done: z.boolean() }))
    .max(30)
    .optional(),
});

export async function PATCH(
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
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  const set: Partial<typeof eventSponsors.$inferInsert> = {};
  if (d.company !== undefined) set.company = d.company;
  if (d.tier !== undefined) set.tier = d.tier;
  if (d.amount !== undefined) set.amount = d.amount;
  if (d.contactName !== undefined) set.contactName = d.contactName?.trim() || null;
  if (d.contactEmail !== undefined) set.contactEmail = d.contactEmail || null;
  if (d.deliverables !== undefined) set.deliverables = d.deliverables;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const [row] = await db
    .update(eventSponsors)
    .set(set)
    .where(eq(eventSponsors.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ sponsor: sponsorToRec(row) });
}
