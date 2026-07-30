import { NextResponse } from "next/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

// The in-app notification feed behind the top-bar bell. Every query is scoped to
// the signed-in user's own rows — the id in the body is only ever used together
// with a userId equality check, so one user can't read or mark another's.

const LIMIT = 30;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [items, unread] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(LIMIT),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);

  return NextResponse.json({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      read: !!n.readAt,
      createdAt: n.createdAt.toISOString(),
    })),
    unread: unread[0]?.count ?? 0,
  });
}

/** Mark one notification read ({ id }) or all of them ({ all: true }). */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { id?: string; all?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const now = new Date();
  if (body.all) {
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  } else if (typeof body.id === "string") {
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.id, body.id), eq(notifications.userId, userId)));
  } else {
    return NextResponse.json({ error: "Provide `id` or `all`" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
