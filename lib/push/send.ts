import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions, users } from "@/lib/db/schema";

// Web Push delivery. SERVER ONLY — holds the VAPID private key.
//
// Push is best-effort by nature: subscriptions rot constantly (permission
// revoked, app deleted, browser storage cleared, push service rotation). Every
// function here is written so a dead subscription is cleaned up quietly and
// NEVER fails the caller — nothing user-facing should break because a phone
// stopped listening.

// Read the non-NEXT_PUBLIC name first. Next inlines NEXT_PUBLIC_* at BUILD
// time, so on Cloud Run (where the image is built by Cloud Build without the
// key, then env vars are set afterwards) the prefixed name would bake in as
// empty. The key still reaches the browser — the /m page passes it down as a
// prop from the server — so it never needs the public prefix at all.
const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:hello@paperboyventures.com";

/** Whether push is configured at all (keys present). */
export function pushConfigured(): boolean {
  return !!PUBLIC_KEY && !!PRIVATE_KEY;
}

let configured = false;
function ensureConfigured(): boolean {
  if (!pushConfigured()) return false;
  if (!configured) {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY as string, PRIVATE_KEY as string);
    configured = true;
  }
  return true;
}

/** What the service worker receives and renders (see public/sw.js). */
export type PushPayload = {
  title: string;
  body: string;
  /** Deep link opened when the notification is tapped. */
  url?: string;
  /** Collapse key — a later push with the same tag replaces the earlier one. */
  tag?: string;
};

type Result = { sent: number; pruned: number; failed: number };

/**
 * Send to every device belonging to these users.
 * Dead endpoints (404 Not Found / 410 Gone) are deleted rather than retried.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<Result> {
  const out: Result = { sent: 0, pruned: 0, failed: 0 };
  if (!ensureConfigured() || userIds.length === 0) return out;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds));
  if (subs.length === 0) return out;

  const body = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60 * 12, urgency: "normal" },
        );
        out.sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          dead.push(s.id);
        } else {
          out.failed++;
          console.error(`[push] send failed (${code ?? "network"}) for ${s.id}`);
        }
      }
    }),
  );

  if (dead.length) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
    out.pruned = dead.length;
  }

  if (out.sent) {
    await db
      .update(pushSubscriptions)
      .set({ lastSentAt: new Date() })
      .where(inArray(pushSubscriptions.userId, userIds));
  }
  return out;
}

/** Every admin/internal user — who should hear about new deal flow. */
export async function staffUserIds(): Promise<string[]> {
  const rows = await db.select({ id: users.id, role: users.role }).from(users);
  return rows.filter((r) => r.role === "admin" || r.role === "internal").map((r) => r.id);
}

/** Send to all staff. Used by the new-deal poller. */
export async function sendPushToStaff(payload: PushPayload): Promise<Result> {
  return sendPushToUsers(await staffUserIds(), payload);
}

/** Remove one device's subscription (used when a user turns notifications off). */
export async function deleteSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/**
 * The wording for a "new brand applications" alert. Pure and exported so the
 * copy is testable without a push service or a Drive round-trip.
 *
 * A single new deal deep-links straight to it; several land on the deal list.
 * The body names up to three companies because that is what fits on a lock
 * screen before the OS truncates.
 */
export function newDealsPayload(companies: string[], ids: string[]): PushPayload {
  const names = companies.filter((c) => c && c.trim());
  const count = Math.max(names.length, ids.length);
  const shown = names.slice(0, 3).join(", ");
  const rest = names.length - Math.min(names.length, 3);
  return {
    title: count === 1 ? "New brand application" : `${count} new brand applications`,
    body: rest > 0 ? `${shown} +${rest} more` : shown || "Open the CRM to review.",
    url: ids.length === 1 ? `/crm/${ids[0]}` : "/m",
    tag: "paperboy-new-deals",
  };
}
