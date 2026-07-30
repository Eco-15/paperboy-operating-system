import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { googleCredentials } from "@/lib/db/schema";
import { oauthClient } from "./oauth";

// Build an OAuth2 client acting as `userId` from their stored refresh token.
// Returns null if that user hasn't connected Google. The googleapis library
// auto-refreshes the access token on demand; we persist rotations via the
// "tokens" event so the stored access token/expiry stay current.
// (Return type is inferred from oauthClient() so it matches google.calendar/
// gmail — importing OAuth2Client directly pulls a mismatched duplicate type.)
export async function getGoogleClientForUser(
  userId: string,
): Promise<ReturnType<typeof oauthClient> | null> {
  const [cred] = await db
    .select()
    .from(googleCredentials)
    .where(eq(googleCredentials.userId, userId))
    .limit(1);
  if (!cred?.refreshToken) return null;

  const client = oauthClient();
  client.setCredentials({
    refresh_token: cred.refreshToken,
    access_token: cred.accessToken ?? undefined,
    expiry_date: cred.expiryDate ?? undefined,
  });

  client.on("tokens", (tokens) => {
    void db
      .update(googleCredentials)
      .set({
        accessToken: tokens.access_token ?? cred.accessToken,
        expiryDate: tokens.expiry_date ?? cred.expiryDate,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      })
      .where(eq(googleCredentials.userId, userId));
  });

  return client;
}
