import { db } from "@/lib/db";
import { gmailMessages } from "@/lib/db/schema";
import type { ActionHandler } from "../../types";
import type { gmail_v1 } from "googleapis";

/**
 * Fetch metadata for specific message IDs and upsert into the DB.
 * Shared by both full sync and incremental (history-based) sync.
 */
export async function upsertGmailMessages(
  gmail: gmail_v1.Gmail,
  userId: string,
  messageIds: string[],
): Promise<number> {
  let synced = 0;

  for (const msgId of messageIds) {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msgId,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "To", "Cc", "Date"],
    });

    const headers = detail.data.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
        ?.value ?? null;

    const toRaw = getHeader("To");
    const ccRaw = getHeader("Cc");

    await db
      .insert(gmailMessages)
      .values({
        gmailId: msgId,
        userId,
        threadId: detail.data.threadId ?? null,
        subject: getHeader("Subject"),
        from: getHeader("From"),
        to: toRaw ? toRaw.split(",").map((s: string) => s.trim()) : [],
        cc: ccRaw ? ccRaw.split(",").map((s: string) => s.trim()) : [],
        snippet: detail.data.snippet ?? null,
        isRead: !(detail.data.labelIds ?? []).includes("UNREAD"),
        labels: detail.data.labelIds ?? [],
        date: getHeader("Date") ? new Date(getHeader("Date")!) : null,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: gmailMessages.gmailId,
        set: {
          snippet: detail.data.snippet ?? null,
          isRead: !(detail.data.labelIds ?? []).includes("UNREAD"),
          labels: detail.data.labelIds ?? [],
          syncedAt: new Date(),
        },
      });

    synced++;
  }

  return synced;
}

export const syncGmail: ActionHandler = async (_params, ctx) => {
  const userId = ctx.session?.user?.id;
  if (!userId) return { ok: false, error: "No user session" };

  const { getGoogleClientForUser } = await import("@/lib/google/user-client");
  const client = await getGoogleClientForUser(userId);
  if (!client) return { ok: false, error: "Failed to create Google client" };

  const gmail = (await import("googleapis")).google.gmail({
    version: "v1",
    auth: client,
  });

  // Fetch last 50 messages
  const listRes = await gmail.users.messages.list({
    userId: "me",
    maxResults: 50,
  });

  const ids = (listRes.data.messages ?? [])
    .map((m) => m.id)
    .filter((id): id is string => !!id);

  const synced = await upsertGmailMessages(gmail, userId, ids);

  return {
    ok: true,
    data: { synced },
    edits: [
      { objectType: "GmailMessage", objectId: userId, operation: "update" },
    ],
  };
};
