import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { portalUpdates } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  publish: z.boolean().optional(),
});

// Edit / publish / unpublish an update (staff only).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { publish, ...fields } = parsed.data;
  const set: Record<string, unknown> = { ...fields, updatedAt: new Date() };
  if (publish === true) {
    set.status = "published";
    set.publishedAt = new Date();
  } else if (publish === false) {
    set.status = "draft";
  }

  const [row] = await db
    .update(portalUpdates)
    .set(set)
    .where(eq(portalUpdates.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ update: row });
}

// Delete an update (staff only).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await db.delete(portalUpdates).where(eq(portalUpdates.id, id));
  return NextResponse.json({ ok: true });
}
