import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { syncChannels } from "@/lib/db/schema";

// Receives Google Calendar push notifications. Google sends a POST with
// channel info in headers whenever events on the watched calendar change.
export async function POST(req: Request) {
  const channelId = req.headers.get("x-goog-channel-id");
  const resourceState = req.headers.get("x-goog-resource-state");
  const token = req.headers.get("x-goog-channel-token");

  // Verify token
  const expected = process.env.SYNC_WEBHOOK_SECRET;
  if (expected && token !== expected) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  // "sync" = initial verification ping from Google
  if (resourceState === "sync") {
    return NextResponse.json({ ok: true });
  }

  if (!channelId) return NextResponse.json({ ok: true });

  // Look up which user owns this channel
  const [channel] = await db
    .select()
    .from(syncChannels)
    .where(eq(syncChannels.channelId, channelId))
    .limit(1);

  if (!channel) return NextResponse.json({ ok: true }); // stale channel

  // Full calendar sync for this user
  try {
    const { syncCalendar } = await import(
      "@/lib/ontology/actions/handlers/sync-calendar"
    );
    await syncCalendar({}, {
      session: { user: { id: channel.userId } },
    });
  } catch (err) {
    console.error("[webhook/calendar] sync error:", err);
  }

  return NextResponse.json({ ok: true });
}
