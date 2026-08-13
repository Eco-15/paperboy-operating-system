import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth/guards";
import { syncBrandAppsFromSheet } from "@/lib/crm/sheet-sync";
import { newDealsPayload, sendPushToStaff } from "@/lib/push/send";

// Pull the szn sheet and push a lock-screen alert for anything new.
//
// This is what makes notifications arrive when nobody has the app open. The
// in-request sync inside GET /api/crm only ever runs while someone is already
// looking at the CRM — useless for alerting — so Cloud Scheduler calls this on
// an interval instead. Two callers, same as the news refresh:
//   • Cloud Scheduler — shared secret in `x-crm-secret`
//   • a staff member  — authenticated session, for manual testing
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = req.headers.get("x-crm-secret");
  const expected = process.env.CRM_POLL_SECRET;
  const viaCron = !!expected && secret === expected;

  if (!viaCron) {
    const session = await auth();
    if (!session?.user || !isStaff(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Fail OPEN on a Drive hiccup: a sync failure must not take the scheduler
  // job red, it just means no new applications were seen this cycle.
  let sync;
  try {
    sync = await syncBrandAppsFromSheet();
  } catch (e) {
    console.error("[crm-poll] sheet sync failed:", e);
    return NextResponse.json({ ok: false, error: "sync failed" }, { status: 200 });
  }

  let push = { sent: 0, pruned: 0, failed: 0 };
  if (sync.inserted > 0) {
    push = await sendPushToStaff(
      newDealsPayload(sync.insertedCompanies, sync.insertedIds),
    );
    console.log(
      `[crm-poll] ${sync.inserted} new → push sent=${push.sent} pruned=${push.pruned} failed=${push.failed}`,
    );
  }

  return NextResponse.json({
    ok: true,
    inserted: sync.inserted,
    updated: sync.updated,
    companies: sync.insertedCompanies,
    push,
  });
}
