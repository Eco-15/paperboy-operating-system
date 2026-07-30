import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { syncGmail } from "@/lib/ontology/actions/handlers/sync-gmail";
import { syncCalendar } from "@/lib/ontology/actions/handlers/sync-calendar";
import { createNotification } from "@/lib/notify/create";

// Per-user re-sync: re-pull THIS user's Gmail + Calendar into the DB (the same
// one-shot sync that runs at connect time). Powers the Settings "Re-sync now"
// button. Distinct from /api/admin/sync, which is staff-only and all-users.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ctx = { session: { user: { id: session.user.id } } };

  async function run(fn: typeof syncGmail) {
    try {
      const r = (await fn({}, ctx)) as { ok?: boolean; data?: { synced?: number }; error?: string };
      return { synced: r?.data?.synced ?? 0, error: r?.ok === false ? r.error : undefined };
    } catch (e) {
      return { synced: 0, error: e instanceof Error ? e.message : String(e) };
    }
  }

  const [gmail, calendar] = await Promise.all([run(syncGmail), run(syncCalendar)]);

  // Feed the notification centre (respects the user's "Sync status" preference).
  const failed = gmail.error || calendar.error;
  await createNotification(session.user.id, {
    type: "sync",
    title: failed ? "Google sync had a problem" : "Google sync complete",
    body: failed
      ? String(failed)
      : `Synced ${calendar.synced} calendar event${calendar.synced === 1 ? "" : "s"} and ${gmail.synced} message${gmail.synced === 1 ? "" : "s"}.`,
    href: "/dashboard",
  });

  return NextResponse.json({ ok: true, gmail, calendar });
}
