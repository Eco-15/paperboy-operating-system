import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { normalizePreferences, type Preferences } from "./types";

/**
 * Load a user's preferences, creating a defaults row on first access (the row is
 * created lazily so we don't have to backfill every existing user). Mirrors the
 * per-user, keyed-by-userId pattern used for googleCredentials.
 */
export async function getOrCreatePreferences(userId: string): Promise<Preferences> {
  const rows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (rows[0]) return normalizePreferences(rows[0]);

  // Insert a defaults row; ignore a race where another request created it first.
  await db.insert(userPreferences).values({ userId }).onConflictDoNothing();
  return normalizePreferences({});
}
