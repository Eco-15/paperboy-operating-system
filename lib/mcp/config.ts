import { appBaseUrl } from "@/lib/google/oauth";

// The app's public origin (from AUTH_URL), e.g. https://paperboy-os-….run.app
// — no trailing slash. Reused as the OAuth issuer / authorization-server base.
export function mcpBaseUrl(): string {
  return appBaseUrl();
}

// The canonical MCP resource identifier (RFC 8707 audience). Access tokens are
// bound to this, and the protected-resource metadata advertises it.
export function mcpResource(): string {
  return `${mcpBaseUrl()}/api/mcp`;
}

// HS256 signing key for MCP access tokens. Dedicated secret, falling back to the
// Auth.js secret so it always has a value in every environment.
export function mcpTokenSecret(): Uint8Array {
  const s = process.env.MCP_TOKEN_SECRET || process.env.AUTH_SECRET;
  if (!s) throw new Error("MCP_TOKEN_SECRET (or AUTH_SECRET) must be set");
  return new TextEncoder().encode(s);
}

export const MCP_SCOPE = "paperboy.ontology";
