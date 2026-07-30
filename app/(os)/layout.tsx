import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isInvestor } from "@/lib/auth/guards";
import ConsoleShell from "@/components/os/ConsoleShell";
import { getOrCreatePreferences } from "@/lib/prefs/store";
import { DEFAULT_PREFERENCES } from "@/lib/prefs/types";
import { getUserProfile } from "@/lib/profile/store";

// Persistent shell for the authenticated operating system (dashboard + tools).
// Mounts once and survives client navigations, so the top bar + left rail stay
// put. The public marketing site (app/(site)/*) and the standalone auth pages
// (login, accept-invite, brand-kit) sit outside this group and are untouched.
export default async function OsLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  // LPs never see the internal console — their whole world is /portal.
  if (isInvestor(session?.user?.role)) redirect("/portal");
  // Preferences AND the display profile both come from the DB: prefs so
  // appearance syncs across devices, profile so a name/photo edit shows up
  // immediately (the JWT session would otherwise hold a stale name until the
  // token was reissued).
  const [prefs, profile] = session?.user?.id
    ? await Promise.all([
        getOrCreatePreferences(session.user.id),
        getUserProfile(session.user.id),
      ])
    : [DEFAULT_PREFERENCES, null];

  const user = session?.user
    ? {
        name: profile?.name ?? session.user.name,
        email: profile?.email ?? session.user.email,
        role: profile?.role ?? session.user.role,
      }
    : null;

  return (
    <ConsoleShell user={user} prefs={prefs}>
      {children}
    </ConsoleShell>
  );
}
