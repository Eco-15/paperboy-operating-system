import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  getClient,
  consumeAuthCode,
  issueRefreshToken,
  consumeRefreshToken,
} from "@/lib/mcp/store";
import { verifyPkce, signAccessToken } from "@/lib/mcp/token";
import { MCP_SCOPE } from "@/lib/mcp/config";

export const runtime = "nodejs";

async function readParams(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v)]));
  }
  const form = await req.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) out[k] = v.toString();
  return out;
}

function oauthError(code: string, description?: string, status = 400) {
  return Response.json(
    { error: code, ...(description ? { error_description: description } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function issueTokens(userId: string, clientId: string) {
  const [u] = await db
    .select({ role: users.role, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return oauthError("invalid_grant", "user not found");

  const access_token = await signAccessToken({ userId, role: u.role, email: u.email });
  const refresh_token = await issueRefreshToken(clientId, userId);
  return Response.json(
    { access_token, token_type: "Bearer", expires_in: 3600, refresh_token, scope: MCP_SCOPE },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const p = await readParams(req);

  if (p.grant_type === "authorization_code") {
    if (!p.code || !p.redirect_uri || !p.client_id || !p.code_verifier) {
      return oauthError("invalid_request", "missing parameters");
    }
    if (!(await getClient(p.client_id))) return oauthError("invalid_client");
    const row = await consumeAuthCode(p.code);
    if (!row) return oauthError("invalid_grant", "code invalid or expired");
    if (row.clientId !== p.client_id) return oauthError("invalid_grant", "client mismatch");
    if (row.redirectUri !== p.redirect_uri) return oauthError("invalid_grant", "redirect_uri mismatch");
    if (!verifyPkce(p.code_verifier, row.codeChallenge)) {
      return oauthError("invalid_grant", "PKCE verification failed");
    }
    return issueTokens(row.userId, row.clientId);
  }

  if (p.grant_type === "refresh_token") {
    if (!p.refresh_token) return oauthError("invalid_request", "missing refresh_token");
    const row = await consumeRefreshToken(p.refresh_token);
    if (!row) return oauthError("invalid_grant", "refresh token invalid or expired");
    if (p.client_id && row.clientId !== p.client_id) {
      return oauthError("invalid_grant", "client mismatch");
    }
    return issueTokens(row.userId, row.clientId);
  }

  return oauthError("unsupported_grant_type", `unsupported grant_type: ${p.grant_type ?? ""}`);
}
