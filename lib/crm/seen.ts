import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";

// The CRM's per-user "new responses" watermark. Every inbound lead that landed
// after `crm_seen_at` is NEW for that person; opening the CRM and acknowledging
// the tray moves the mark forward.
//
// SERVER ONLY (touches the DB) — never import from a client component.
//
// The watermark MUST be stamped with Postgres' now(), never a JS Date. Every
// timestamp in this schema is `timestamp` (no time zone): now() writes local
// wall-clock, while node-postgres serialises a JS Date as UTC. Mixing the two
// puts the watermark hours off from the created_at values it's compared
// against — ahead of them west of UTC (nothing ever looks new), behind them
// east of it (everything does).
const NOW = sql`now()`;

/**
 * Read the user's watermark, creating the preferences row on first access
 * (same lazy-upsert pattern as lib/prefs/store.ts).
 *
 * On the very first visit there is no watermark, so we stamp it and report
 * `null` — otherwise every lead ever received would arrive as "new".
 */
export async function getCrmSeenAt(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ crmSeenAt: userPreferences.crmSeenAt })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (row?.crmSeenAt) return row.crmSeenAt;

  // No row, or a row that predates this column: start the clock now.
  await advanceCrmSeenAt(userId);
  return null;
}

/** Mark everything currently inbound as seen. */
export async function advanceCrmSeenAt(userId: string): Promise<void> {
  await db
    .insert(userPreferences)
    .values({ userId, crmSeenAt: NOW })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { crmSeenAt: NOW },
    });
}
