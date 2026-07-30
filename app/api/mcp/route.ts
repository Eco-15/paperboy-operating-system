import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTools } from "@/lib/mcp/tools";
import { verifyMcpToken } from "@/lib/mcp/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// The remote MCP server (Streamable HTTP). basePath "/api" → this route at /api/mcp.
// Stateless (no sessionIdGenerator) + SSE disabled, so no Redis is required.
const handler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  { serverInfo: { name: "paperboy-ontology", version: "1.0.0" } },
  { basePath: "/api", disableSse: true },
);

// Require a valid, audience-bound Bearer token on every request; missing/invalid
// → 401 + WWW-Authenticate pointing at the protected-resource metadata. We let the
// metadata URL derive from the request origin (X-Forwarded-* on Cloud Run) so it
// resolves to the /.well-known route; audience binding is enforced in verifyMcpToken.
const authed = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authed as GET, authed as POST, authed as DELETE };
