import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { portalDocuments } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  category: z.enum(["report", "financials", "legal", "deck", "other"]).optional(),
  sharedWithAll: z.boolean().optional(),
  sharedWith: z.array(z.string()).optional(),
});

// Update a document's metadata / audience (staff only).
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
  const [row] = await db
    .update(portalDocuments)
    .set(parsed.data)
    .where(eq(portalDocuments.id, id))
    .returning({ id: portalDocuments.id });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// Delete a document (staff only).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await db.delete(portalDocuments).where(eq(portalDocuments.id, id));
  return NextResponse.json({ ok: true });
}
