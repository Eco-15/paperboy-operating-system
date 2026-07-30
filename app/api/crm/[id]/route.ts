import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { brandApps, inquiries } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { brandAppToDeal, inquiryToDeal } from "@/lib/crm/map";
import { ALL_STATUSES, FUNDS } from "@/lib/crm/stages";

// Update a single deal. Staff-only. `origin` picks the backing table:
//  • "app"  → brand_app  (full set of editable fields)
//  • "form" → inquiry    (only stage + message exist on that table)
// This is the app's first PATCH endpoint; it mirrors the by-id + async-params
// shape used by the DELETE routes (e.g. app/api/chats/[id]).
const patchSchema = z.object({
  origin: z.enum(["app", "form"]),
  // Board stages + archive statuses (Passed/Hold/Watch) are both legal values.
  stage: z.enum(ALL_STATUSES as [string, ...string[]]).optional(),
  priority: z.coerce.number().int().min(1).max(6).nullable().optional(),
  fund: z.enum(FUNDS as [string, ...string[]]).nullable().optional(),
  archived: z.boolean().optional(),
  message: z.string().max(5000).nullable().optional(),
  category: z.string().max(120).nullable().optional(),
  subcategory: z.string().max(120).nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  contactEmail: z.string().email().max(200).nullable().optional().or(z.literal("")),
  website: z.string().max(500).nullable().optional(),
});

function clean(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

// Fetch one deal in full (the list API's lite mode strips the heavy fields;
// the mobile deal sheet re-fetches here). Staff-only, id checked in both tables.
export async function GET(
  _req: Request,
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
  const [app] = await db.select().from(brandApps).where(eq(brandApps.id, id)).limit(1);
  if (app) return NextResponse.json({ deal: brandAppToDeal(app) });
  const [form] = await db.select().from(inquiries).where(eq(inquiries.id, id)).limit(1);
  if (form) return NextResponse.json({ deal: inquiryToDeal(form) });
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

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

  if (d.origin === "form") {
    // inquiry carries stage, fund, archived + message.
    const set: Partial<typeof inquiries.$inferInsert> = {};
    if (d.stage !== undefined) set.stage = d.stage;
    if (d.fund !== undefined) set.fund = d.fund;
    if (d.archived !== undefined) set.archived = d.archived;
    if (d.message !== undefined) set.message = clean(d.message);
    if (Object.keys(set).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    const [row] = await db
      .update(inquiries)
      .set(set)
      .where(eq(inquiries.id, id))
      .returning();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ deal: inquiryToDeal(row) });
  }

  const set: Partial<typeof brandApps.$inferInsert> = {};
  if (d.stage !== undefined) set.stage = d.stage;
  if (d.priority !== undefined) set.priority = d.priority;
  if (d.fund !== undefined) set.fund = d.fund;
  if (d.archived !== undefined) set.archived = d.archived;
  if (d.message !== undefined) set.message = clean(d.message);
  if (d.category !== undefined) set.category = clean(d.category);
  if (d.subcategory !== undefined) set.subcategory = clean(d.subcategory);
  if (d.contactName !== undefined) set.contactName = clean(d.contactName);
  if (d.contactEmail !== undefined) set.contactEmail = clean(d.contactEmail);
  if (d.website !== undefined) set.website = clean(d.website);
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const [row] = await db
    .update(brandApps)
    .set(set)
    .where(eq(brandApps.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deal: brandAppToDeal(row) });
}
