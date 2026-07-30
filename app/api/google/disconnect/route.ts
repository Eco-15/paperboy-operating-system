import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  googleCredentials,
  syncChannels,
  gmailMessages,
  calendarEvents,
} from "@/lib/db/schema";
import { getGoogleClientForUser } from "@/lib/google/user-client";

// Remove the signed-in user's Google connection: stop push channels, clean up
// synced data, and delete their credential row.
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Stop active push channels before deleting credentials
  const channels = await db
    .select()
    .from(syncChannels)
    .where(eq(syncChannels.userId, userId));

  if (channels.length) {
    try {
      const client = await getGoogleClientForUser(userId);
      if (client) {
        const { google } = await import("googleapis");

        for (const ch of channels) {
          if (!ch.channelId || !ch.resourceId) continue;
          try {
            if (ch.service === "calendar") {
              const cal = google.calendar({ version: "v3", auth: client });
              await cal.channels.stop({
                requestBody: {
                  id: ch.channelId,
                  resourceId: ch.resourceId,
                },
              });
            }
            // Gmail watches don't have a channels.stop — they expire naturally
          } catch {
            /* channel may have already expired */
          }
        }
      }
    } catch {
      /* best-effort cleanup */
    }
  }

  // Delete synced data and channel records
  await db
    .delete(syncChannels)
    .where(eq(syncChannels.userId, userId));
  await db
    .delete(gmailMessages)
    .where(eq(gmailMessages.userId, userId));
  await db
    .delete(calendarEvents)
    .where(eq(calendarEvents.userId, userId));

  // Finally remove the credential
  await db
    .delete(googleCredentials)
    .where(eq(googleCredentials.userId, userId));

  return NextResponse.json({ ok: true });
}
