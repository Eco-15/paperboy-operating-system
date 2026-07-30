import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth/guards";
import { isConfigured, BeehiivError } from "@/lib/beehiiv/client";

// Staff-only + Beehiiv-configured gate for the newsletter API routes. Returns a
// NextResponse to short-circuit with (401/403/503), or null to proceed.
export async function newsletterGate(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isConfigured()) {
    return NextResponse.json({ error: "beehiiv_not_configured" }, { status: 503 });
  }
  return null;
}

// Normalize a thrown Beehiiv error into a route response (surfaces the upstream
// status + detail so the UI can show plan-gating messages, e.g. for sends).
export function beehiivErrorResponse(e: unknown): NextResponse {
  if (e instanceof BeehiivError) {
    const status = e.status === 503 ? 503 : e.status >= 400 && e.status < 500 ? e.status : 502;
    return NextResponse.json(
      { error: "beehiiv_api_error", upstreamStatus: e.status, detail: e.body },
      { status },
    );
  }
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}
