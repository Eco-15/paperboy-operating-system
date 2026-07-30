import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { invites, lpProfiles } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";

const patchSchema = z.object({
  entityName: z.string().min(1).optional(),
  contactName: z.string().nullable().optional(),
  commitmentUsd: z.number().int().nonnegative().nullable().optional(),
  investedUsd: z.number().int().nonnegative().nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
  notes: z.string().nullable().optional(),
});

// Update an LP profile (staff only).
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
    .update(lpProfiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(lpProfiles.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ investor: row });
}

// Issue a fresh investor invite for an LP who hasn't joined yet (staff only).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const [lp] = await db
    .select()
    .from(lpProfiles)
    .where(eq(lpProfiles.id, id))
    .limit(1);
  if (!lp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (lp.userId) {
    return NextResponse.json(
      { error: "This investor already has an account." },
      { status: 400 },
    );
  }

  const token = crypto.randomUUID();
  await db.insert(invites).values({
    email: lp.email,
    role: "investor",
    token,
    invitedBy: user.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  const base = process.env.AUTH_URL ?? new URL(req.url).origin;
  return NextResponse.json(
    { acceptUrl: `${base}/accept-invite?token=${token}` },
    { status: 201 },
  );
}

// Remove an LP profile (staff only). Their user account, if any, is untouched.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await db.delete(lpProfiles).where(eq(lpProfiles.id, id));
  return NextResponse.json({ ok: true });
}
