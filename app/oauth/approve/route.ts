import { auth } from "@/auth";
import { isStaff } from "@/lib/auth/guards";
import { getClient, createAuthCode } from "@/lib/mcp/store";

export const runtime = "nodejs";

// Consent POST from the authorize page. Re-checks the session + client, then
// issues a short-lived, PKCE-bound authorization code and redirects back to Claude.
export async function POST(req: Request) {
  const session = await auth();
  const form = await req.formData();
  const get = (k: string) => form.get(k)?.toString() ?? "";

  const clientId = get("client_id");
  const redirectUri = get("redirect_uri");
  const codeChallenge = get("code_challenge");
  const state = get("state");
  const scope = get("scope");
  const resource = get("resource");
  const decision = get("decision");

  // Re-validate (defense in depth): never redirect to an unregistered URI.
  const client = clientId ? await getClient(clientId) : null;
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return new Response("Invalid client or redirect_uri.", { status: 400 });
  }

  const back = (params: Record<string, string>) => {
    const url = new URL(redirectUri);
    for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
    return Response.redirect(url.toString(), 302);
  };

  if (!session?.user || !isStaff(session.user.role) || decision !== "allow") {
    return back({ error: "access_denied", state });
  }

  const code = await createAuthCode({
    clientId,
    userId: session.user.id,
    redirectUri,
    codeChallenge,
    resource: resource || null,
    scope: scope || null,
  });
  return back({ code, state });
}
