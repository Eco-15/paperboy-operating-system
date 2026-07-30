"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { SITE_NAME, CONTACT_EMAIL } from "@/lib/marketing/brand";

// The Members' Entrance is a page of the paper: same broadsheet sheet as the
// public site (folio, wordmark, double rules, paper texture) with the sign-in
// form set as a clip-out coupon.

// Where to land after sign-in: honour ?callbackUrl (middleware appends it for
// gated pages, e.g. the installed mobile app's /m). NextAuth writes it as an
// absolute URL, so accept either a relative path or a same-origin absolute URL;
// anything cross-origin falls back to the dashboard.
function landingPath(): string {
  const raw = new URLSearchParams(window.location.search).get("callbackUrl");
  if (!raw) return "/dashboard";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw);
    if (url.origin === window.location.origin) return url.pathname + url.search;
  } catch {
    /* fall through */
  }
  return "/dashboard";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      setError("Incorrect email or password.");
    } else {
      window.location.href = landingPath();
    }
  }

  return (
    <div className="site">
      <main className="site-main">
        <div className="sheet sheet--section">
          <div className="sheet-folio">
            <span>Est. 2026 · New York</span>
            <span>Members&apos; Entrance</span>
            <Link href="/">Front Page</Link>
          </div>
          <div className="sheet-wordmark">
            <Link href="/">{SITE_NAME}</Link>
          </div>
          <div className="sheet-kicker">Staff &amp; Partners · Credentials Required</div>
          <div className="fp-rule" />

          <div className="sheet-body sheet-login">
            <h2 className="fp-headline sheet-login-headline">The Press Room</h2>
            <p className="fp-deck fp-deck--sm sheet-login-deck">
              Sign in to reach the operating desk — deal flow, the tally, the
              library, and the wires.
            </p>

            <form className="sheet-coupon sheet-login-coupon" onSubmit={handleCredentials}>
              <div className="sheet-coupon-title">Admit One · Members Only</div>

              <button
                type="button"
                className="sheet-login-google"
                onClick={() => signIn("google", { redirectTo: landingPath() })}
              >
                Continue with Google — Staff
              </button>

              <div className="sheet-login-or">
                <span />
                or
                <span />
              </div>

              <label className="sheet-coupon-field">
                <span className="sheet-coupon-label">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </label>
              <label className="sheet-coupon-field">
                <span className="sheet-coupon-label">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </label>

              {error && <p className="sheet-coupon-error">{error}</p>}

              <button type="submit" className="sheet-coupon-submit sheet-login-submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <p className="sheet-login-fine">
              Clients &amp; investors sign in with the email &amp; password from
              their invitation.
            </p>
          </div>

          <div className="sheet-colophon">
            © 2026 {SITE_NAME} · Printed daily · Price: Free ·{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </div>
        </div>
      </main>
    </div>
  );
}
