import { google } from "googleapis";
import { db } from "@/lib/db";
import { syncChannels } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getGoogleClientForUser } from "./user-client";

function webhookUrl(): string {
  const base = (process.env.AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}/api/webhooks/calendar`;
}

/**
 * Register a Calendar push channel for a user. Channels expire
 * (typically ~7 days); the periodic sync job renews them.
 */
export async function registerCalendarWatch(userId: string): Promise<void> {
  const client = await getGoogleClientForUser(userId);
  if (!client) return;

  const calendar = google.calendar({ version: "v3", auth: client });
  const channelId = crypto.randomUUID();

  // Stop existing channel first
  const [existing] = await db
    .select()
    .from(syncChannels)
    .where(
      and(
        eq(syncChannels.userId, userId),
        eq(syncChannels.service, "calendar"),
      ),
    )
    .limit(1);

  if (existing?.channelId && existing?.resourceId) {
    try {
      await calendar.channels.stop({
        requestBody: {
          id: existing.channelId,
          resourceId: existing.resourceId,
        },
      });
    } catch {
      /* channel may have already expired */
    }
  }

  const res = await calendar.events.watch({
    calendarId: "primary",
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: webhookUrl(),
      token: process.env.SYNC_WEBHOOK_SECRET,
    },
  });

  const values = {
    channelId,
    resourceId: res.data.resourceId ?? null,
    expiration: res.data.expiration
      ? new Date(Number(res.data.expiration))
      : null,
  };

  if (existing) {
    await db
      .update(syncChannels)
      .set(values)
      .where(eq(syncChannels.id, existing.id));
  } else {
    await db.insert(syncChannels).values({
      userId,
      service: "calendar",
      ...values,
    });
  }
}
