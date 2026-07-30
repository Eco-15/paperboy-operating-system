import { metadataCorsOptionsRequestHandler } from "mcp-handler";
import { mcpBaseUrl, MCP_SCOPE } from "@/lib/mcp/config";

export const runtime = "nodejs";

// RFC 8414 — authorization server metadata. Advertises our authorize/token/
// register endpoints, PKCE (S256), and public-client (no secret) auth.
export function GET() {
  const base = mcpBaseUrl();
  return Response.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [MCP_SCOPE],
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
