import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";

// Workspace member list for the Settings > Workspace card. Staff-only: clients
// must not be able to enumerate the workspace. Read-only — role changes are a
// separate, deliberate admin action.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt));

  return NextResponse.json({
    members: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      joinedAt: r.createdAt.toISOString(),
    })),
    staffDomain: process.env.ALLOWED_STAFF_DOMAIN ?? null,
  });
}
