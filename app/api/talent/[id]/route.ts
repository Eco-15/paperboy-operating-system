import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { talents } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { talentToRec } from "@/lib/talent/map";
import { ALL_STATUSES } from "@/lib/talent/stages";

// Update a single person on the talent roster. Staff-only. Mirrors the deal
// CRM's PATCH (app/api/crm/[id]) but over the single `talent` table.
const patchSchema = z.object({
  // Board stages + archive statuses (Passed/Hold/Bench) are both legal values.
  stage: z.enum(ALL_STATUSES as [string, ...string[]]).optional(),
  priority: z.coerce.number().int().min(1).max(6).nullable().optional(),
  archived: z.boolean().optional(),
  name: z.string().min(1).max(200).optional(),
  role: z.string().max(120).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  email: z.string().email().max(200).nullable().optional().or(z.literal("")),
  link: z.string().max(500).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

function clean(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
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

  const set: Partial<typeof talents.$inferInsert> = {};
  if (d.stage !== undefined) set.stage = d.stage;
  if (d.priority !== undefined) set.priority = d.priority;
  if (d.archived !== undefined) set.archived = d.archived;
  if (d.name !== undefined) set.name = d.name.trim();
  if (d.role !== undefined) set.role = clean(d.role);
  if (d.company !== undefined) set.company = clean(d.company);
  if (d.email !== undefined) set.email = clean(d.email);
  if (d.link !== undefined) set.link = clean(d.link);
  if (d.location !== undefined) set.location = clean(d.location);
  if (d.notes !== undefined) set.notes = clean(d.notes);
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const [row] = await db
    .update(talents)
    .set(set)
    .where(eq(talents.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ person: talentToRec(row) });
}
