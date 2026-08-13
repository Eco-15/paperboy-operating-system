import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { deleteSubscription, pushConfigured, sendPushToUsers } from "@/lib/push/send";

// A device registering (or dropping) itself for lock-screen notifications.
// Staff-only — this is deal-flow alerting, not a client-facing feature.

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
  /** Send a "notifications are on" push straight back, so the user sees proof. */
  test: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!pushConfigured()) {
    return NextResponse.json(
      { error: "Push is not configured on this server (missing VAPID keys)." },
      { status: 503 },
    );
  }

  const parsed = subscribeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  const { endpoint, keys, test } = parsed.data;
  const userId = session.user.id;

  // The endpoint is globally unique per device+origin. Re-subscribing the same
  // device (or one that changed hands) updates the row rather than duplicating.
  await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: keys.p256dh, auth: keys.auth },
    });

  if (test) {
    await sendPushToUsers([userId], {
      title: "Notifications are on",
      body: "New brand applications will show up here.",
      url: "/m",
      tag: "paperboy-test",
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

// Turning notifications off for this device.
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const endpoint = new URL(req.url).searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }
  // Scoped to the caller — you can only unsubscribe your own device.
  const [row] = await db
    .select({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .limit(1);
  if (row && row.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await deleteSubscription(endpoint);
  return new NextResponse(null, { status: 204 });
}
