import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { portfolioCompanies } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  highlight: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  status: z.enum(["active", "exited"]).optional(),
  investedOn: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  visible: z.boolean().optional(),
});

// Update a portfolio company (staff only).
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
    .update(portfolioCompanies)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(portfolioCompanies.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ company: row });
}

// Remove a portfolio company (staff only).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await db.delete(portfolioCompanies).where(eq(portfolioCompanies.id, id));
  return NextResponse.json({ ok: true });
}
