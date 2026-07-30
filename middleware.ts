import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge-safe: built only from authConfig (no DB, no bcrypt). Enforces that the
// protected route prefixes in auth.config.ts require a signed-in session.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Run on everything except Next internals, the auth API, and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|json|csv)$).*)"],
};
