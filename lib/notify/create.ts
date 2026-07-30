import { db } from "@/lib/db";
import { notifications, type NotifyCategory } from "@/lib/db/schema";
import { getOrCreatePreferences } from "@/lib/prefs/store";

/**
 * Server-side producer for the in-app notification feed (the top-bar bell).
 *
 * Respects the user's per-category preference: if they've turned off in-app
 * delivery for this category, nothing is written. Never throws — a notification
 * failing must not take down the action that triggered it.
 */
export async function createNotification(
  userId: string,
  n: { type: NotifyCategory; title: string; body?: string; href?: string },
): Promise<void> {
  try {
    const prefs = await getOrCreatePreferences(userId);
    if (!prefs.notify[n.type]?.inApp) return;

    await db.insert(notifications).values({
      userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      href: n.href ?? null,
    });
  } catch (e) {
    console.error("[notify] failed to create notification", e);
  }
}
