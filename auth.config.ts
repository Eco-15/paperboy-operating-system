import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

const staffDomain = process.env.ALLOWED_STAFF_DOMAIN;

// Edge-safe config shared by middleware and the full Node auth.ts.
// IMPORTANT: do not import the database (pg) or bcrypt here — middleware runs on
// the edge runtime. The adapter and the Credentials provider live in auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_OAUTH_ID,
      clientSecret: process.env.GOOGLE_OAUTH_SECRET,
      authorization: {
        params: staffDomain
          ? { hd: staffDomain, prompt: "select_account" }
          : { prompt: "select_account" },
      },
    }),
  ],
  callbacks: {
    // Route-level gate run by middleware: these prefixes require a session.
    // Finer role checks (internal vs client) happen server-side in pages/routes.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const protectedPrefixes = [
        "/dashboard",
        "/chat",
        "/poker",
        "/blog",
        "/investors",
        "/news",
        "/admin",
        "/portal",
        "/site-editor",
      ];
      // The mobile shell is matched exactly (never "/manifest.webmanifest" etc.):
      // installed-PWA launches must land on /login when signed out.
      const isMobileShell =
        nextUrl.pathname === "/m" || nextUrl.pathname.startsWith("/m/");
      const isProtected =
        isMobileShell ||
        protectedPrefixes.some((p) => nextUrl.pathname.startsWith(p));
      return isProtected ? isLoggedIn : true;
    },
  },
} satisfies NextAuthConfig;
