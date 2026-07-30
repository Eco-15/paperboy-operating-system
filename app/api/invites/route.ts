import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { invites } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";

const createSchema = z.object({
  email: z.string().email(),
  role: z.enum(["client", "internal", "investor"]).default("client"),
});

// List invites (staff only).
export async function GET() {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await db.select().from(invites).orderBy(desc(invites.createdAt));
  return NextResponse.json({ invites: rows });
}

// Create an invite (staff only). Returns the accept link.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [row] = await db
    .insert(invites)
    .values({
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      token,
      invitedBy: session.user.id,
      expiresAt,
    })
    .returning();

  const base = process.env.AUTH_URL ?? new URL(req.url).origin;
  return NextResponse.json(
    { invite: row, acceptUrl: `${base}/accept-invite?token=${token}` },
    { status: 201 },
  );
}
