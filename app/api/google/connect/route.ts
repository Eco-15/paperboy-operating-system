import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { consentUrl, appBaseUrl } from "@/lib/google/oauth";

// Start the per-account Google connect flow: send the signed-in user to Google's
// consent screen for read-only Calendar + Gmail. A random state (stored in an
// httpOnly cookie) is verified on the callback.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", appBaseUrl()));
  }

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(consentUrl(state, session.user.email ?? undefined));
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
