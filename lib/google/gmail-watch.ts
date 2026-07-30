import { google } from "googleapis";
import { db } from "@/lib/db";
import { syncChannels } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getGoogleClientForUser } from "./user-client";

const TOPIC = process.env.GMAIL_PUBSUB_TOPIC ?? "";

/**
 * Register a Gmail Pub/Sub watch for a user. Watches expire after ~7 days;
 * the periodic sync job renews them before expiry.
 */
export async function registerGmailWatch(userId: string): Promise<void> {
  if (!TOPIC) return;

  const client = await getGoogleClientForUser(userId);
  if (!client) return;

  const gmail = google.gmail({ version: "v1", auth: client });
  const res = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: TOPIC,
      labelIds: ["INBOX"],
    },
  });

  const channelId = crypto.randomUUID();
  const values = {
    channelId,
    resourceId: null as string | null,
    expiration: res.data.expiration
      ? new Date(Number(res.data.expiration))
      : null,
    lastHistoryId: res.data.historyId ? String(res.data.historyId) : null,
  };

  // Upsert: one Gmail channel per user
  const [existing] = await db
    .select()
    .from(syncChannels)
    .where(
      and(eq(syncChannels.userId, userId), eq(syncChannels.service, "gmail")),
    )
    .limit(1);

  if (existing) {
    await db
      .update(syncChannels)
      .set(values)
      .where(eq(syncChannels.id, existing.id));
  } else {
    await db.insert(syncChannels).values({
      userId,
      service: "gmail",
      ...values,
    });
  }
}

/**
 * Incremental Gmail sync: fetches only messages changed since the stored
 * historyId. Returns the number of messages synced, or -1 to signal that
 * the caller should fall back to a full sync.
 */
export async function incrementalGmailSync(userId: string): Promise<number> {
  const [channel] = await db
    .select()
    .from(syncChannels)
    .where(
      and(eq(syncChannels.userId, userId), eq(syncChannels.service, "gmail")),
    )
    .limit(1);

  if (!channel?.lastHistoryId) return -1;

  const client = await getGoogleClientForUser(userId);
  if (!client) return 0;

  const gmail = google.gmail({ version: "v1", auth: client });

  try {
    const historyRes = await gmail.users.history.list({
      userId: "me",
      startHistoryId: channel.lastHistoryId,
      historyTypes: ["messageAdded", "labelAdded", "labelRemoved"],
    });

    const history = historyRes.data.history ?? [];
    const messageIds = new Set<string>();

    for (const h of history) {
      for (const added of h.messagesAdded ?? []) {
        if (added.message?.id) messageIds.add(added.message.id);
      }
      for (const lc of [
        ...(h.labelsAdded ?? []),
        ...(h.labelsRemoved ?? []),
      ]) {
        if (lc.message?.id) messageIds.add(lc.message.id);
      }
    }

    if (messageIds.size > 0) {
      // Lazy import to avoid circular deps at module level
      const { upsertGmailMessages } = await import(
        "@/lib/ontology/actions/handlers/sync-gmail"
      );
      await upsertGmailMessages(gmail, userId, [...messageIds]);
    }

    // Update historyId watermark
    if (historyRes.data.historyId) {
      await db
        .update(syncChannels)
        .set({ lastHistoryId: historyRes.data.historyId })
        .where(eq(syncChannels.id, channel.id));
    }

    return messageIds.size;
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 404 || code === 410) {
      // historyId expired — fall back to full sync
      return -1;
    }
    throw err;
  }
}
