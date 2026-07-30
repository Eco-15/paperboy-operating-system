import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { googleCredentials } from "@/lib/db/schema";
import { oauthClient, appBaseUrl } from "@/lib/google/oauth";

// Google redirects here after consent. Verify state, exchange the code, and
// store THIS user's refresh token. Then back to the dashboard.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", appBaseUrl()));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const store = await cookies();
  const savedState = store.get("g_oauth_state")?.value;

  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/dashboard?google=${reason}`, appBaseUrl()));
    res.cookies.set("g_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  };

  if (oauthError || !code || !state || !savedState || state !== savedState) {
    return fail("error");
  }

  try {
    const { tokens } = await oauthClient().getToken(code);
    if (!tokens.refresh_token) {
      // Happens if the user already granted before without revoking. They can
      // remove access at myaccount.google.com and reconnect.
      return fail("norefresh");
    }

    await db
      .insert(googleCredentials)
      .values({
        userId: session.user.id,
        email: session.user.email ?? null,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token ?? null,
        expiryDate: tokens.expiry_date ?? null,
        scope: tokens.scope ?? null,
      })
      .onConflictDoUpdate({
        target: googleCredentials.userId,
        set: {
          email: session.user.email ?? null,
          refreshToken: tokens.refresh_token,
          accessToken: tokens.access_token ?? null,
          expiryDate: tokens.expiry_date ?? null,
          scope: tokens.scope ?? null,
          connectedAt: new Date(),
        },
      });

    // Register push channels for near-real-time sync
    try {
      const { registerGmailWatch } = await import("@/lib/google/gmail-watch");
      await registerGmailWatch(session.user.id);
    } catch (err) {
      console.error("[google/callback] Gmail watch registration failed:", err);
    }

    try {
      const { registerCalendarWatch } = await import("@/lib/google/calendar-watch");
      await registerCalendarWatch(session.user.id);
    } catch (err) {
      console.error("[google/callback] Calendar watch registration failed:", err);
    }

    // Initial full sync so the dashboard has data immediately
    try {
      const { syncGmail } = await import("@/lib/ontology/actions/handlers/sync-gmail");
      await syncGmail({}, { session: { user: { id: session.user.id } } });
    } catch (err) {
      console.error("[google/callback] Initial Gmail sync failed:", err);
    }

    try {
      const { syncCalendar } = await import("@/lib/ontology/actions/handlers/sync-calendar");
      await syncCalendar({}, { session: { user: { id: session.user.id } } });
    } catch (err) {
      console.error("[google/callback] Initial Calendar sync failed:", err);
    }

    const res = NextResponse.redirect(new URL("/dashboard?google=connected", appBaseUrl()));
    res.cookies.set("g_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  } catch {
    return fail("error");
  }
}
