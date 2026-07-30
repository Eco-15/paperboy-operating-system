import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { verifyAccessToken } from "./token";
import { mcpResource, MCP_SCOPE } from "./config";
import type { OntologySession } from "@/lib/ontology/auth";

// The role gate lives in lib/ontology/auth.ts so the MCP server, the in-app chat
// agent, and any future host all enforce the SAME rules. Re-exported here for the
// existing MCP call sites.
export { canRead, canAct } from "@/lib/ontology/auth";
export type McpSession = OntologySession;

// mcp-handler `withMcpAuth` verifyToken: validate the Bearer JWT → AuthInfo, with
// the user identity stashed in `extra` for the tool handlers. Returns undefined
// (→ 401) on any failure.
export async function verifyMcpToken(
  _req: Request,
  bearer?: string,
): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;
  const claims = await verifyAccessToken(bearer);
  if (!claims) return undefined;
  return {
    token: bearer,
    clientId: "mcp",
    scopes: [MCP_SCOPE],
    resource: new URL(mcpResource()),
    extra: { userId: claims.userId, role: claims.role, email: claims.email },
  };
}

// Rebuild the ontology session from the validated token claims.
export function sessionFromAuthInfo(authInfo: AuthInfo | undefined): OntologySession | null {
  const e = authInfo?.extra;
  if (!e || typeof e.userId !== "string") return null;
  return {
    user: {
      id: e.userId,
      role: (e.role as string | null) ?? null,
      email: (e.email as string | null) ?? null,
    },
  };
}
