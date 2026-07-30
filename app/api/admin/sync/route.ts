import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { googleCredentials, syncChannels } from "@/lib/db/schema";
import { lt } from "drizzle-orm";

// Allow long-running sync across all users.
export const maxDuration = 300;

// Cloud Scheduler hits this every 4 hours: full sync all users, renew
// expiring push channels, and re-ingest Drive. Also callable by staff.
export async function POST(req: Request) {
  // Auth: shared secret header (Cloud Scheduler) OR authenticated staff
  const secret = req.headers.get("x-sync-secret");
  const expected = process.env.SYNC_WEBHOOK_SECRET;
  if (!expected || secret !== expected) {
    const { auth } = await import("@/auth");
    const { isStaff } = await import("@/lib/auth/guards");
    const session = await auth();
    if (!session?.user || !isStaff(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const results: Record<string, unknown> = {};
  // A scheduled job that always returns 200 can fail every run forever without
  // anyone noticing — which is how the Drive index stayed broken. Collect failures
  // and report them in the status code.
  const errors: string[] = [];

  // 1. Full Gmail + Calendar sync for every connected user
  const allCreds = await db.select().from(googleCredentials);
  let usersSynced = 0;

  for (const cred of allCreds) {
    try {
      const { syncGmail } = await import(
        "@/lib/ontology/actions/handlers/sync-gmail"
      );
      await syncGmail({}, { session: { user: { id: cred.userId } } });
    } catch (err) {
      console.error(`[sync] Gmail failed for ${cred.userId}:`, err);
      errors.push(`gmail/${cred.userId}: ${(err as Error).message}`);
    }

    try {
      const { syncCalendar } = await import(
        "@/lib/ontology/actions/handlers/sync-calendar"
      );
      await syncCalendar({}, { session: { user: { id: cred.userId } } });
    } catch (err) {
      console.error(`[sync] Calendar failed for ${cred.userId}:`, err);
      errors.push(`calendar/${cred.userId}: ${(err as Error).message}`);
    }

    usersSynced++;
  }
  results.usersSynced = usersSynced;

  // 2. Renew push channels expiring within 2 hours
  const soonExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const expiring = await db
    .select()
    .from(syncChannels)
    .where(lt(syncChannels.expiration, soonExpiry));

  let channelsRenewed = 0;
  for (const ch of expiring) {
    try {
      if (ch.service === "gmail") {
        const { registerGmailWatch } = await import(
          "@/lib/google/gmail-watch"
        );
        await registerGmailWatch(ch.userId);
      } else if (ch.service === "calendar") {
        const { registerCalendarWatch } = await import(
          "@/lib/google/calendar-watch"
        );
        await registerCalendarWatch(ch.userId);
      } else if (ch.service === "drive") {
        const { registerDriveWatch } = await import(
          "@/lib/google/drive-watch"
        );
        await registerDriveWatch();
      }
      channelsRenewed++;
    } catch (err) {
      console.error(
        `[sync] Channel renewal failed for ${ch.service}/${ch.userId}:`,
        err,
      );
      errors.push(`channel/${ch.service}/${ch.userId}: ${(err as Error).message}`);
    }
  }
  results.channelsRenewed = channelsRenewed;

  // 3. Drive ingest — deliberately NOT run here.
  //
  // It used to run inline, inside this HTTP request, on a 1 GB container. Ingest
  // buffers whole files into memory, so a 204 MB PDF (the FON Series A memo) blew the
  // container's memory and the request 504'd — every single run. The memo was never
  // indexed, and because the failure was swallowed it looked like the file simply
  // wasn't there. Drive ingest now runs in the `drive-ingest` Cloud Run Job (4 GB,
  // 1h timeout), triggered by its own Cloud Scheduler job.
  results.drive = "handled by the drive-ingest Cloud Run Job (not run in-request)";

  const ok = errors.length === 0;
  return NextResponse.json(
    { ok, ...results, ...(ok ? {} : { errors }) },
    { status: ok ? 200 : 500 },
  );
}
