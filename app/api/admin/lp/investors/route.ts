import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { invites, lpProfiles, users } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";

const createSchema = z.object({
  entityName: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email(),
  commitmentUsd: z.number().int().nonnegative().nullable().optional(),
  investedUsd: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().optional(),
});

function acceptUrlFor(req: Request, token: string) {
  const base = process.env.AUTH_URL ?? new URL(req.url).origin;
  return `${base}/accept-invite?token=${token}`;
}

// List LP profiles with account/invite status (staff only).
export async function GET(req: Request) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lps = await db
    .select()
    .from(lpProfiles)
    .orderBy(desc(lpProfiles.createdAt));

  // Pending invite links for LPs who haven't created their account yet.
  const emails = lps.filter((l) => !l.userId).map((l) => l.email);
  const pending = emails.length
    ? await db
        .select()
        .from(invites)
        .where(inArray(invites.email, emails))
        .orderBy(desc(invites.createdAt))
    : [];
  const inviteByEmail = new Map<string, (typeof pending)[number]>();
  for (const inv of pending) {
    if (!inviteByEmail.has(inv.email)) inviteByEmail.set(inv.email, inv);
  }

  return NextResponse.json({
    investors: lps.map((l) => {
      const inv = l.userId ? undefined : inviteByEmail.get(l.email);
      const inviteValid = inv && !inv.acceptedAt && inv.expiresAt > new Date();
      return {
        ...l,
        accountStatus: l.userId ? "active" : inviteValid ? "invited" : "no-invite",
        acceptUrl: inviteValid ? acceptUrlFor(req, inv.token) : null,
      };
    }),
  });
}

// Create an LP profile + investor invite in one step (staff only).
export async function POST(req: Request) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  const [existingLp] = await db
    .select({ id: lpProfiles.id })
    .from(lpProfiles)
    .where(eq(lpProfiles.email, email))
    .limit(1);
  if (existingLp) {
    return NextResponse.json(
      { error: "An investor with this email already exists." },
      { status: 409 },
    );
  }

  // If they already have an account (e.g. previously invited as a client),
  // link it right away; otherwise issue an investor invite.
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const [lp] = await db
    .insert(lpProfiles)
    .values({
      email,
      entityName: parsed.data.entityName,
      contactName: parsed.data.contactName || null,
      commitmentUsd: parsed.data.commitmentUsd ?? null,
      investedUsd: parsed.data.investedUsd ?? null,
      notes: parsed.data.notes || null,
      userId: existingUser?.id ?? null,
    })
    .returning();

  let acceptUrl: string | null = null;
  if (!existingUser) {
    const token = crypto.randomUUID();
    await db.insert(invites).values({
      email,
      role: "investor",
      token,
      invitedBy: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    acceptUrl = acceptUrlFor(req, token);
  }

  return NextResponse.json({ investor: lp, acceptUrl }, { status: 201 });
}
