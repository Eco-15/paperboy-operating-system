import { createClient } from "@/lib/mcp/store";

export const runtime = "nodejs";

// RFC 7591 dynamic client registration. Public clients only (no secret): the MCP
// client (Claude) posts its redirect_uris and gets back a client_id.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { redirect_uris?: unknown; client_name?: unknown }
    | null;

  const redirectUris = body?.redirect_uris;
  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    !redirectUris.every((u) => typeof u === "string")
  ) {
    return Response.json(
      { error: "invalid_client_metadata", error_description: "redirect_uris is required" },
      { status: 400 },
    );
  }

  // Redirect URIs must be https (or localhost for dev) — open-redirect guard.
  for (const u of redirectUris as string[]) {
    try {
      const url = new URL(u);
      const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      if (url.protocol !== "https:" && !local) throw new Error("insecure");
    } catch {
      return Response.json(
        { error: "invalid_redirect_uri", error_description: `bad redirect_uri: ${u}` },
        { status: 400 },
      );
    }
  }

  const client = await createClient(
    redirectUris as string[],
    typeof body?.client_name === "string" ? body.client_name : undefined,
  );

  return Response.json(
    {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      ...(client.clientName ? { client_name: client.clientName } : {}),
    },
    { status: 201 },
  );
}
