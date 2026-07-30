import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { googleCredentials } from "@/lib/db/schema";
import { getUserProfile } from "@/lib/profile/store";
import SettingsView from "@/components/settings/SettingsView";

export const metadata: Metadata = { title: "Settings · Paperboy OS" };

export default async function SettingsPage() {
  const user = await requireUser();

  // Profile comes from the DB (not the JWT) so an edit shows up immediately.
  const [rows, profile] = await Promise.all([
    user.id
      ? db
          .select()
          .from(googleCredentials)
          .where(eq(googleCredentials.userId, user.id))
          .limit(1)
      : Promise.resolve([]),
    user.id ? getUserProfile(user.id) : Promise.resolve(null),
  ]);
  const cred = rows[0];

  return (
    <main className="os-main tool-main">
      <div className="tool-head">
        <div>
          <div className="tool-title">Settings</div>
          <div className="tool-sub">Manage your profile, appearance, and notifications</div>
        </div>
      </div>
      <SettingsView
        name={profile?.name ?? user.name ?? null}
        email={profile?.email ?? user.email ?? null}
        image={profile?.image ?? null}
        role={profile?.role ?? user.role ?? null}
        google={
          cred
            ? {
                connected: true,
                email: cred.email ?? null,
                connectedAt: cred.connectedAt ? cred.connectedAt.toISOString() : null,
              }
            : { connected: false, email: null, connectedAt: null }
        }
      />
    </main>
  );
}
