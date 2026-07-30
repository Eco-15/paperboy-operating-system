import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { userPreferences, type NotifyPrefs } from "@/lib/db/schema";
import { getOrCreatePreferences } from "@/lib/prefs/store";
import { normalizePreferences } from "@/lib/prefs/types";

// Per-user preferences (Settings). Always scoped to the signed-in user — the
// userId comes from the session, never from the request body.

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const prefs = await getOrCreatePreferences(session.user.id);
  return NextResponse.json(prefs);
}

const THEMES = ["light", "dark", "system"];
const DENSITIES = ["comfortable", "compact"];
const DATE_FORMATS = ["auto", "mdy", "dmy", "iso"];

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Whitelist + validate each field; ignore anything unrecognized.
  const patch: Partial<typeof userPreferences.$inferInsert> = {};
  if (typeof body.theme === "string" && THEMES.includes(body.theme)) patch.theme = body.theme;
  if (typeof body.density === "string" && DENSITIES.includes(body.density)) patch.density = body.density;
  if (typeof body.reduceMotion === "boolean") patch.reduceMotion = body.reduceMotion;
  if (typeof body.railCollapsed === "boolean") patch.railCollapsed = body.railCollapsed;
  if (body.timezone === null || typeof body.timezone === "string") {
    patch.timezone = (body.timezone as string) || null;
  }
  if (typeof body.dateFormat === "string" && DATE_FORMATS.includes(body.dateFormat)) {
    patch.dateFormat = body.dateFormat;
  }
  if (body.notify && typeof body.notify === "object") {
    // Re-normalize through the current stored prefs so a partial notify patch
    // (e.g. one category) doesn't drop the others.
    const current = await getOrCreatePreferences(userId);
    const incoming = body.notify as Partial<NotifyPrefs>;
    patch.notifyPrefs = { ...current.notify, ...incoming } as NotifyPrefs;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }
  patch.updatedAt = new Date();

  // Upsert: create the row if the user has never saved a preference before.
  await db
    .insert(userPreferences)
    .values({ userId, ...patch })
    .onConflictDoUpdate({ target: userPreferences.userId, set: patch });

  const rows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return NextResponse.json(normalizePreferences(rows[0] ?? {}));
}
