import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";
import { mcpBaseUrl, mcpResource, mcpTokenSecret } from "./config";

export interface McpTokenClaims {
  userId: string;
  role: string | null;
  email: string | null;
}

// Mint an audience-bound access token for the MCP resource (RFC 8707).
export async function signAccessToken(c: McpTokenClaims, ttlSec = 3600): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: c.role, email: c.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(c.userId)
    .setIssuer(mcpBaseUrl())
    .setAudience(mcpResource())
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSec)
    .sign(mcpTokenSecret());
}

// Verify signature + issuer + audience. Returns null on any failure (expired,
// wrong audience, bad signature) so the caller responds 401.
export async function verifyAccessToken(token: string): Promise<McpTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, mcpTokenSecret(), {
      issuer: mcpBaseUrl(),
      audience: mcpResource(),
    });
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      role: (payload.role as string | null) ?? null,
      email: (payload.email as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

// ── PKCE (S256) ───────────────────────────────────────────────────────────────
export function pkceChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
export function verifyPkce(verifier: string, challenge: string): boolean {
  return pkceChallengeFromVerifier(verifier) === challenge;
}

// ── Opaque token helpers ──────────────────────────────────────────────────────
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
