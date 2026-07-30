import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mcpClients, mcpAuthCodes, mcpRefreshTokens } from "@/lib/db/schema";
import { randomToken, sha256Hex } from "./token";

// ── Dynamic client registration (RFC 7591) ────────────────────────────────────
export async function createClient(redirectUris: string[], clientName?: string) {
  const clientId = `mcp_${randomToken(16)}`;
  await db.insert(mcpClients).values({
    clientId,
    clientName: clientName ?? null,
    redirectUris,
  });
  return { clientId, redirectUris, clientName: clientName ?? null };
}

export async function getClient(clientId: string) {
  const [row] = await db
    .select()
    .from(mcpClients)
    .where(eq(mcpClients.clientId, clientId))
    .limit(1);
  return row ?? null;
}

// ── Authorization codes (short-lived, single-use, PKCE-bound) ─────────────────
export async function createAuthCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string | null;
  scope: string | null;
  ttlSec?: number;
}): Promise<string> {
  const code = randomToken(32);
  const expiresAt = new Date(Date.now() + (input.ttlSec ?? 60) * 1000);
  await db.insert(mcpAuthCodes).values({
    code,
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    resource: input.resource,
    scope: input.scope,
    expiresAt,
  });
  return code;
}

// Atomically read-and-delete (single use). Returns null if unknown or expired.
export async function consumeAuthCode(code: string) {
  const [row] = await db
    .delete(mcpAuthCodes)
    .where(eq(mcpAuthCodes.code, code))
    .returning();
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

// ── Refresh tokens (rotating; only the hash is stored) ────────────────────────
export async function issueRefreshToken(
  clientId: string,
  userId: string,
  ttlSec = 60 * 60 * 24 * 30,
): Promise<string> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ttlSec * 1000);
  await db.insert(mcpRefreshTokens).values({
    tokenHash: sha256Hex(token),
    clientId,
    userId,
    expiresAt,
  });
  return token;
}

// Consume (delete) a refresh token; returns its owner if still valid.
export async function consumeRefreshToken(token: string) {
  const [row] = await db
    .delete(mcpRefreshTokens)
    .where(eq(mcpRefreshTokens.tokenHash, sha256Hex(token)))
    .returning();
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}
