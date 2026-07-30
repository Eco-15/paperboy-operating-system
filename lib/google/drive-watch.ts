import { db } from "@/lib/db";
import { syncChannels } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getDriveClient } from "@/lib/rag/drive";

function webhookUrl(): string {
  const base = (process.env.AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}/api/webhooks/drive`;
}

// Fixed userId for the system-level Drive watch (service account, not per-user)
const SYSTEM_USER_ID = "system";

/**
 * Register a Drive changes push channel using the service account.
 * One channel for the entire Shared Drive.
 */
export async function registerDriveWatch(): Promise<void> {
  const drive = getDriveClient();
  const channelId = crypto.randomUUID();

  // Get baseline page token for change tracking
  const startToken = await drive.changes.getStartPageToken({
    supportsAllDrives: true,
    driveId: process.env.SHARED_DRIVE_ID,
  });

  // Stop existing channel if any
  const [existing] = await db
    .select()
    .from(syncChannels)
    .where(
      and(
        eq(syncChannels.userId, SYSTEM_USER_ID),
        eq(syncChannels.service, "drive"),
      ),
    )
    .limit(1);

  if (existing?.channelId && existing?.resourceId) {
    try {
      await drive.channels.stop({
        requestBody: {
          id: existing.channelId,
          resourceId: existing.resourceId,
        },
      });
    } catch {
      /* may have expired */
    }
  }

  const res = await drive.changes.watch({
    pageToken: startToken.data.startPageToken!,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
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
    lastPageToken: startToken.data.startPageToken,
  };

  if (existing) {
    await db
      .update(syncChannels)
      .set(values)
      .where(eq(syncChannels.id, existing.id));
  } else {
    await db.insert(syncChannels).values({
      userId: SYSTEM_USER_ID,
      service: "drive",
      ...values,
    });
  }
}
