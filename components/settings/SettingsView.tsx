"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/os/PreferencesProvider";
import { toast } from "@/lib/notify/toast";
import { NOTIFY_CATEGORIES, type Density, type Theme } from "@/lib/prefs/types";
import type { NotifyCategory } from "@/lib/db/schema";
import Switch from "./Switch";

type Google = { connected: boolean; email: string | null; connectedAt: string | null };

interface Section {
  id: string;
  label: string;
  show: boolean;
}

export default function SettingsView({
  name,
  email,
  image,
  role,
  google,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
  role: string | null;
  google: Google;
}) {
  const staff = role === "admin" || role === "internal";

  const sections: Section[] = [
    { id: "profile", label: "Profile", show: true },
    { id: "appearance", label: "Appearance", show: true },
    { id: "notifications", label: "Notifications", show: true },
    { id: "regional", label: "Regional", show: true },
    { id: "integrations", label: "Integrations", show: true },
    { id: "workspace", label: "Workspace", show: staff },
    { id: "account", label: "Account", show: true },
  ].filter((s) => s.show);

  const [active, setActive] = useState("profile");

  // Highlight the nav item for whichever section is currently in view.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-90px 0px -60% 0px" },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff]);

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`settings-nav-item${active === s.id ? " is-active" : ""}`}
          >
            {s.label}
          </a>
        ))}
      </nav>

      <div className="settings">
        <ProfileCard name={name} email={email} image={image} role={role} />
        <AppearanceCard />
        <NotificationsCard />
        <RegionalCard />
        <IntegrationsCard google={google} />
        {staff && <WorkspaceCard />}
        <AccountCard email={email} role={role} staff={staff} />
      </div>
    </div>
  );
}

/* ── Profile ─────────────────────────────────────────────────────────────── */

function ProfileCard({
  name,
  email,
  image,
  role,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
  role: string | null;
}) {
  const router = useRouter();
  const [draftName, setDraftName] = useState(name ?? "");
  const [draftImage, setDraftImage] = useState(image ?? "");
  const [busy, setBusy] = useState(false);

  const dirty = draftName.trim() !== (name ?? "") || draftImage.trim() !== (image ?? "");
  const initials = (draftName || email || "?").trim().charAt(0).toUpperCase();

  async function save() {
    setBusy(true);
    try {
      const r = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftName.trim(), image: draftImage.trim() || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not save");
      toast("Profile updated", { type: "success" });
      router.refresh(); // re-renders the shell so the top bar shows the new name
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", { type: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-card" id="profile">
      <div className="settings-card-head">
        <h2 className="settings-h">Profile</h2>
        <p className="settings-sub">How you appear across Paperboy OS.</p>
      </div>

      <div className="settings-account" style={{ marginBottom: 18 }}>
        {draftImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="settings-avatar"
            src={draftImage}
            alt=""
            onError={() => setDraftImage("")}
          />
        ) : (
          <div className="settings-avatar" aria-hidden="true">{initials}</div>
        )}
        <div className="settings-acc-body">
          <div className="settings-acc-name">{draftName || "—"}</div>
          <div className="settings-acc-email">{email || "—"}</div>
          {role && <span className="settings-pill settings-pill--role">{role}</span>}
        </div>
      </div>

      <div className="settings-field">
        <label className="settings-field-label" htmlFor="pf-name">Display name</label>
        <input
          id="pf-name"
          className="settings-input"
          value={draftName}
          maxLength={80}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Your name"
        />
      </div>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="pf-photo">Photo URL</label>
        <input
          id="pf-photo"
          className="settings-input"
          value={draftImage}
          onChange={(e) => setDraftImage(e.target.value)}
          placeholder="https://… (leave blank to use your initials)"
        />
      </div>

      <div className="settings-acc-actions">
        <button
          className="tool-btn tool-btn--solid"
          type="button"
          onClick={save}
          disabled={!dirty || busy || !draftName.trim()}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        {dirty && !busy && (
          <button
            className="tool-btn"
            type="button"
            onClick={() => {
              setDraftName(name ?? "");
              setDraftImage(image ?? "");
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </section>
  );
}

/* ── Appearance ──────────────────────────────────────────────────────────── */

const THEME_OPTS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "☾" },
  { value: "system", label: "System", icon: "◐" },
];

const DENSITY_OPTS: { value: Density; label: string }[] = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

function AppearanceCard() {
  const { prefs, update } = usePreferences();

  function set<K extends "theme" | "density" | "reduceMotion" | "railCollapsed">(
    key: K,
    value: (typeof prefs)[K],
  ) {
    update({ [key]: value }).catch((e) =>
      toast(e instanceof Error ? e.message : "Could not save", { type: "error" }),
    );
  }

  return (
    <section className="settings-card" id="appearance">
      <div className="settings-card-head">
        <h2 className="settings-h">Appearance</h2>
        <p className="settings-sub">Applies instantly and follows you to every device you sign in on.</p>
      </div>

      <div className="settings-row">
        <div className="settings-row-body">
          <div className="settings-row-label">Theme</div>
          <div className="settings-row-desc">
            &ldquo;System&rdquo; follows your operating system&rsquo;s light/dark setting.
          </div>
        </div>
        <div className="settings-row-control">
          <div className="seg" role="group" aria-label="Theme">
            {THEME_OPTS.map((o) => (
              <button
                key={o.value}
                type="button"
                className="seg-btn"
                aria-pressed={prefs.theme === o.value}
                onClick={() => set("theme", o.value)}
              >
                <span className="seg-ico" aria-hidden="true">{o.icon}</span>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-body">
          <div className="settings-row-label">Density</div>
          <div className="settings-row-desc">Compact tightens table rows and cards to fit more on screen.</div>
        </div>
        <div className="settings-row-control">
          <div className="seg" role="group" aria-label="Density">
            {DENSITY_OPTS.map((o) => (
              <button
                key={o.value}
                type="button"
                className="seg-btn"
                aria-pressed={prefs.density === o.value}
                onClick={() => set("density", o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-body">
          <div className="settings-row-label">Reduce motion</div>
          <div className="settings-row-desc">Turn off transitions and animations across the OS.</div>
        </div>
        <div className="settings-row-control">
          <Switch
            checked={prefs.reduceMotion}
            onChange={(v) => set("reduceMotion", v)}
            label="Reduce motion"
          />
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-body">
          <div className="settings-row-label">Collapse sidebar by default</div>
          <div className="settings-row-desc">Start with the left nav rail collapsed to icons.</div>
        </div>
        <div className="settings-row-control">
          <Switch
            checked={prefs.railCollapsed}
            onChange={(v) => set("railCollapsed", v)}
            label="Collapse sidebar by default"
          />
        </div>
      </div>
    </section>
  );
}

/* ── Notifications ───────────────────────────────────────────────────────── */

function NotificationsCard() {
  const { prefs, update } = usePreferences();

  function toggle(cat: NotifyCategory, channel: "inApp" | "email", value: boolean) {
    update({
      notify: { ...prefs.notify, [cat]: { ...prefs.notify[cat], [channel]: value } },
    }).catch((e) => toast(e instanceof Error ? e.message : "Could not save", { type: "error" }));
  }

  return (
    <section className="settings-card" id="notifications">
      <div className="settings-card-head">
        <h2 className="settings-h">Notifications</h2>
        <p className="settings-sub">Choose what reaches you, and where.</p>
      </div>

      <div className="notify-grid">
        <div className="notify-head">
          <div className="notify-head-spacer" />
          <div className="notify-col">In-app</div>
          <div className="notify-col">Email</div>
        </div>

        {NOTIFY_CATEGORIES.map((c) => (
          <div className="notify-row" key={c.key}>
            <div className="notify-row-body">
              <div className="settings-row-label">{c.label}</div>
              <div className="settings-row-desc">{c.desc}</div>
            </div>
            <div className="notify-cell">
              <Switch
                checked={prefs.notify[c.key].inApp}
                onChange={(v) => toggle(c.key, "inApp", v)}
                label={`${c.label} — in-app`}
              />
            </div>
            <div className="notify-cell">
              <Switch
                checked={prefs.notify[c.key].email}
                onChange={(v) => toggle(c.key, "email", v)}
                label={`${c.label} — email`}
                disabled
              />
            </div>
          </div>
        ))}
      </div>

      <p className="notify-note">
        In-app notifications appear under the bell in the top bar. Email delivery isn&rsquo;t
        switched on yet — your choice is saved and will apply as soon as it is.
      </p>
    </section>
  );
}

/* ── Regional ────────────────────────────────────────────────────────────── */

const DATE_OPTS = [
  { value: "auto", label: "Automatic" },
  { value: "mdy", label: "MM/DD/YYYY" },
  { value: "dmy", label: "DD/MM/YYYY" },
  { value: "iso", label: "YYYY-MM-DD" },
];

function RegionalCard() {
  const { prefs, update } = usePreferences();

  // Intl.supportedValuesOf isn't in older lib typings; guard and fall back.
  const zones = useMemo(() => {
    try {
      const fn = (
        Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
      ).supportedValuesOf;
      return fn ? fn("timeZone") : [];
    } catch {
      return [];
    }
  }, []);

  const browserZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  }, []);

  function set(patch: Parameters<typeof update>[0]) {
    update(patch).catch((e) =>
      toast(e instanceof Error ? e.message : "Could not save", { type: "error" }),
    );
  }

  return (
    <section className="settings-card" id="regional">
      <div className="settings-card-head">
        <h2 className="settings-h">Regional</h2>
        <p className="settings-sub">How dates and times are shown on your dashboard.</p>
      </div>

      <div className="settings-row">
        <div className="settings-row-body">
          <div className="settings-row-label">Time zone</div>
          <div className="settings-row-desc">
            Calendar and inbox times render in this zone. Default follows your browser ({browserZone}).
          </div>
        </div>
        <div className="settings-row-control">
          <select
            className="settings-select"
            aria-label="Time zone"
            value={prefs.timezone ?? ""}
            onChange={(e) => set({ timezone: e.target.value || null })}
          >
            <option value="">Automatic ({browserZone})</option>
            {zones.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-body">
          <div className="settings-row-label">Date format</div>
          <div className="settings-row-desc">&ldquo;Automatic&rdquo; uses your locale&rsquo;s convention.</div>
        </div>
        <div className="settings-row-control">
          <select
            className="settings-select"
            aria-label="Date format"
            value={prefs.dateFormat}
            onChange={(e) => set({ dateFormat: e.target.value as typeof prefs.dateFormat })}
          >
            {DATE_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}

/* ── Integrations ────────────────────────────────────────────────────────── */

function IntegrationsCard({ google }: { google: Google }) {
  const [busy, setBusy] = useState(false);

  async function resync() {
    setBusy(true);
    try {
      const r = await fetch("/api/google/resync", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Sync failed");
      const c = d.calendar?.synced ?? 0;
      const g = d.gmail?.synced ?? 0;
      const err = d.calendar?.error || d.gmail?.error;
      if (c === 0 && g === 0 && err) {
        toast(`Couldn't sync: ${err}`, { type: "error" });
        return;
      }
      toast(
        `Synced ${c} calendar event${c === 1 ? "" : "s"} and ${g} message${g === 1 ? "" : "s"}.`,
        { type: "success" },
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Sync failed", { type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect your Google account? Synced calendar & inbox data will be removed.")) return;
    setBusy(true);
    await fetch("/api/google/disconnect", { method: "POST" }).catch(() => {});
    window.location.reload();
  }

  return (
    <section className="settings-card" id="integrations">
      <div className="settings-card-head">
        <h2 className="settings-h">Integrations</h2>
        <p className="settings-sub">Connect Google so your dashboard can show your calendar and inbox.</p>
      </div>
      <div className="settings-integration">
        <div className="settings-int-mark" aria-hidden="true">G</div>
        <div className="settings-int-body">
          <div className="settings-int-title">Google Workspace</div>
          {google.connected ? (
            <div className="settings-int-meta">
              <span className="settings-pill settings-pill--on">Connected</span>
              {google.email && <span>· {google.email}</span>}
              {google.connectedAt && <span>· since {new Date(google.connectedAt).toLocaleDateString()}</span>}
            </div>
          ) : (
            <div className="settings-int-meta">
              <span className="settings-pill settings-pill--off">Not connected</span>
              <span>· Calendar &amp; Gmail (read-only)</span>
            </div>
          )}
        </div>
        <div className="settings-int-actions">
          {google.connected ? (
            <>
              <button className="tool-btn tool-btn--solid" type="button" onClick={resync} disabled={busy}>
                {busy ? "Syncing…" : "Re-sync now"}
              </button>
              <button className="tool-btn" type="button" onClick={disconnect} disabled={busy}>
                Disconnect
              </button>
            </>
          ) : (
            <a className="tool-btn tool-btn--solid" href="/api/google/connect">
              Connect Google
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Workspace (staff only) ──────────────────────────────────────────────── */

interface Member {
  id: string;
  name: string | null;
  email: string;
  role: string;
  joinedAt: string;
}

function WorkspaceCard() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [staffDomain, setStaffDomain] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/members")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load members"))))
      .then((d) => {
        setMembers(d.members ?? []);
        setStaffDomain(d.staffDomain ?? null);
      })
      .catch(() => setMembers([]));
  }, []);

  return (
    <section className="settings-card" id="workspace">
      <div className="settings-card-head">
        <h2 className="settings-h">Workspace</h2>
        <p className="settings-sub">
          Everyone with access to Paperboy OS.
          {staffDomain && <> Staff sign in with Google at <strong>@{staffDomain}</strong>.</>}
        </p>
      </div>

      {members === null ? (
        <div className="members-empty">Loading members…</div>
      ) : members.length === 0 ? (
        <div className="members-empty">No members found.</div>
      ) : (
        <table className="members">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.name || "—"}</td>
                <td>{m.email}</td>
                <td><span className="settings-pill settings-pill--role">{m.role}</span></td>
                <td>{new Date(m.joinedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="settings-acc-actions" style={{ marginTop: 16 }}>
        <a className="tool-btn" href="/admin/invites">Manage invitations</a>
      </div>
    </section>
  );
}

/* ── Account ─────────────────────────────────────────────────────────────── */

function AccountCard({
  email,
  role,
  staff,
}: {
  email: string | null;
  role: string | null;
  staff: boolean;
}) {
  return (
    <section className="settings-card" id="account">
      <div className="settings-card-head">
        <h2 className="settings-h">Account</h2>
        <p className="settings-sub">
          Signed in as {email || "—"}
          {role ? ` · ${role}` : ""}.
        </p>
      </div>
      <div className="settings-acc-actions">
        {staff && <a className="tool-btn" href="/admin/invites">Invitations</a>}
        <button className="tool-btn" type="button" onClick={() => signOut({ redirectTo: "/login" })}>
          Sign out
        </button>
      </div>
    </section>
  );
}
