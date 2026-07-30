import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth/guards";
import { advanceCrmSeenAt } from "@/lib/crm/seen";

// Acknowledge the CRM's "new responses" tray: everything inbound up to now is
// seen by this user. Called when they hit "Mark all caught up" and (via
// sendBeacon) when they leave the CRM — never as a side effect of GET /api/crm,
// which the phone app re-fires on every pull-to-refresh.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await advanceCrmSeenAt(session.user.id);
  return new NextResponse(null, { status: 204 });
}
