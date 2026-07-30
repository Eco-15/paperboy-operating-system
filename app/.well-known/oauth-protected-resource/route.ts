import { generateProtectedResourceMetadata, metadataCorsOptionsRequestHandler } from "mcp-handler";
import { mcpBaseUrl, mcpResource, MCP_SCOPE } from "@/lib/mcp/config";

export const runtime = "nodejs";

// RFC 9728 — tells the MCP client which authorization server protects /api/mcp.
export function GET() {
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [mcpBaseUrl()],
    resourceUrl: mcpResource(),
    additionalMetadata: { scopes_supported: [MCP_SCOPE] },
  });
  return Response.json(metadata, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
