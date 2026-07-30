import type { ReactNode } from "react";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth/guards";
import { getClient } from "@/lib/mcp/store";
import GoogleContinue from "./GoogleContinue";

export const runtime = "nodejs";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? "" : v ?? "");

function Shell({ children }: { children: ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "hsla(46,26%,90%,1)", padding: 24 }}>
      <div style={{ maxWidth: 460, width: "100%", background: "#fff", border: "1px solid #111", borderRadius: 14, padding: "32px 34px", fontFamily: "Georgia, serif", color: "#111", lineHeight: 1.55 }}>
        {children}
      </div>
    </main>
  );
}

// OAuth 2.1 authorization endpoint (interactive). Validates the request, then
// either prompts Google sign-in or shows a consent screen. Approval is handled
// by POST /oauth/approve (issues the code + redirects).
export default async function AuthorizePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const p = {
    response_type: first(sp.response_type),
    client_id: first(sp.client_id),
    redirect_uri: first(sp.redirect_uri),
    code_challenge: first(sp.code_challenge),
    code_challenge_method: first(sp.code_challenge_method),
    state: first(sp.state),
    scope: first(sp.scope),
    resource: first(sp.resource),
  };

  // Validate BEFORE any redirect (never bounce to an unvalidated redirect_uri).
  const errors: string[] = [];
  if (p.response_type !== "code") errors.push("response_type must be 'code'.");
  if (!p.client_id) errors.push("Missing client_id.");
  if (!p.code_challenge) errors.push("Missing PKCE code_challenge.");
  if (p.code_challenge_method !== "S256") errors.push("code_challenge_method must be S256.");
  if (!p.redirect_uri) errors.push("Missing redirect_uri.");

  const client = p.client_id ? await getClient(p.client_id) : null;
  if (p.client_id && !client) errors.push("Unknown client_id.");
  if (client && !client.redirectUris.includes(p.redirect_uri)) errors.push("redirect_uri is not registered for this client.");

  if (errors.length) {
    return (
      <Shell>
        <h1 style={{ fontSize: "1.3rem", marginBottom: 12 }}>Couldn&apos;t start the connection</h1>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: ".95rem" }}>
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      </Shell>
    );
  }

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) qs.set(k, v);
  const selfUrl = `/oauth/authorize?${qs.toString()}`;

  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return (
      <Shell>
        <h1 style={{ fontSize: "1.4rem", marginBottom: 8 }}>Connect Paperboy to Claude</h1>
        <p style={{ fontSize: ".95rem", marginBottom: 22 }}>
          Sign in with your Paperboy staff Google account to authorize this connector.
        </p>
        <GoogleContinue callbackUrl={selfUrl} />
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 style={{ fontSize: "1.4rem", marginBottom: 8 }}>Connect Paperboy to Claude</h1>
      <p style={{ fontSize: ".95rem", marginBottom: 6 }}>
        Authorize <strong>{client?.clientName || "Claude"}</strong> to search and act on Paperboy data on your behalf.
      </p>
      <p style={{ fontSize: ".9rem", color: "#555", marginBottom: 22 }}>
        It will act as <strong>{session.user.email}</strong>, with exactly your permissions — you only ever see your own data.
      </p>
      <form method="post" action="/oauth/approve" style={{ display: "flex", gap: 12 }}>
        <input type="hidden" name="client_id" value={p.client_id} />
        <input type="hidden" name="redirect_uri" value={p.redirect_uri} />
        <input type="hidden" name="code_challenge" value={p.code_challenge} />
        <input type="hidden" name="state" value={p.state} />
        <input type="hidden" name="scope" value={p.scope} />
        <input type="hidden" name="resource" value={p.resource} />
        <button type="submit" name="decision" value="allow" style={{ fontFamily: "monospace", background: "#111", color: "#fff", border: "1px solid #111", borderRadius: 8, padding: "11px 22px", cursor: "pointer" }}>
          Authorize
        </button>
        <button type="submit" name="decision" value="deny" style={{ fontFamily: "monospace", background: "transparent", color: "#111", border: "1px solid #111", borderRadius: 8, padding: "11px 22px", cursor: "pointer" }}>
          Cancel
        </button>
      </form>
    </Shell>
  );
}
