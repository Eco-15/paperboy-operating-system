import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { authConfig } from "./auth.config";
import { db } from "./lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "./lib/db/schema";
import { verifyPassword } from "./lib/auth/password";

const staffDomain = process.env.ALLOWED_STAFF_DOMAIN;

// Sessions last a year and roll forward on use, so the installed phone app
// (app/(mobile)) never drops you back to a login screen. jwt.maxAge must be set
// too — otherwise the token itself still expires at the Auth.js default of 30
// days and middleware rejects it while the cookie is nominally still valid.
// Trade-off: under the JWT strategy there is no server-side revocation, so a
// lost device holds a valid session until it expires; the only kill switch is
// rotating AUTH_SECRET, which signs everyone out everywhere.
const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const SESSION_UPDATE_AGE = 60 * 60 * 24; // re-issue the cookie at most daily

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // JWT strategy is required to combine an adapter with the Credentials provider.
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },
  jwt: { maxAge: SESSION_MAX_AGE },
  providers: [
    ...authConfig.providers,
    // Invited clients sign in with email + password (set when they accept).
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = creds?.email as string | undefined;
        const password = creds?.password as string | undefined;
        if (!email || !password) return null;

        const [row] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);
        if (!row?.passwordHash) return null;

        const ok = await verifyPassword(password, row.passwordHash);
        if (!ok) return null;

        return {
          id: row.id,
          name: row.name,
          email: row.email,
          image: row.image,
          role: row.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      // Restrict Google (staff) sign-in to the Workspace domain, if configured.
      if (account?.provider === "google") {
        const p = profile as
          | { email_verified?: boolean; email?: string }
          | undefined;
        if (!p?.email_verified) return false;
        if (staffDomain && !p.email?.endsWith(`@${staffDomain}`)) return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      // Backfill role for Google staff (adapter returns the base user shape).
      if (token.id && !token.role) {
        const [row] = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1);
        token.role = row?.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string | undefined;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // The adapter only creates users for Google staff sign-ins (clients are
      // created through the invite flow). Promote those staff to "internal".
      if (
        user.id &&
        user.email &&
        (!staffDomain || user.email.endsWith(`@${staffDomain}`))
      ) {
        await db
          .update(users)
          .set({ role: "internal" })
          .where(eq(users.id, user.id));
      }
    },
  },
});
