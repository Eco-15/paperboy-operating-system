import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { invites, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createNotification } from "@/lib/notify/create";

const schema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(8),
});

// Public: look up an invite by token to show who it's for on the accept page.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.token, token))
    .limit(1);
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ valid: false });
  }
  return NextResponse.json({ valid: true, email: invite.email });
}

// Public: an invited person sets their name + password and becomes a user.
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.token, parsed.data.token))
    .limit(1);

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This invite is invalid or has expired." },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, invite.email))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Just sign in." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.insert(users).values({
    email: invite.email,
    name: parsed.data.name,
    role: invite.role,
    passwordHash,
  });
  await db
    .update(invites)
    .set({ acceptedAt: new Date() })
    .where(eq(invites.id, invite.id));

  // Tell whoever sent the invite that it landed (respects their "Invites & team"
  // preference; never throws, so a failure here can't fail the signup).
  if (invite.invitedBy) {
    await createNotification(invite.invitedBy, {
      type: "team",
      title: "Invite accepted",
      body: `${parsed.data.name} (${invite.email}) joined as ${invite.role}.`,
      href: "/admin/invites",
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
