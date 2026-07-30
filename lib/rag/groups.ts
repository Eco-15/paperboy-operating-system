import { google } from "googleapis";

// Resolve the set of Drive "principals" a signed-in user satisfies, so retrieval
// can filter to files they're actually allowed to open. A principal is one of:
//   - their own email (lower-cased)
//   - `domain:<their-domain>`   (files shared to the whole Workspace domain)
//   - `anyone`                  (files shared publicly)
//   - each Google Group they belong to (files shared to that group)
//
// Group membership requires the Admin SDK Directory API + domain-wide delegation
// for the service account (env GOOGLE_ADMIN_SUBJECT = an admin to impersonate).
// Without it, group expansion is skipped and only direct/domain/anyone shares
// resolve — files shared *only* via a group are then hidden (fail-closed).

interface CacheEntry {
  principals: string[];
  expires: number;
}
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

async function fetchGroupEmails(email: string): Promise<string[]> {
  const subject = process.env.GOOGLE_ADMIN_SUBJECT;
  if (!subject) return []; // Admin SDK not configured → no group expansion.

  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/admin.directory.group.readonly"],
    clientOptions: { subject },
  });
  const admin = google.admin({ version: "directory_v1", auth });

  const emails: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await admin.groups.list({
      userKey: email,
      maxResults: 200,
      pageToken,
    });
    for (const g of res.data.groups ?? []) {
      if (g.email) emails.push(g.email.toLowerCase());
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return emails;
}

export async function resolveUserPrincipals(email: string): Promise<string[]> {
  const key = email.toLowerCase();
  if (!key) return [];

  const cached = CACHE.get(key);
  const now = Date.now();
  if (cached && cached.expires > now) return cached.principals;

  const domain = key.includes("@") ? key.split("@")[1] : "";
  const principals = new Set<string>([key, "anyone"]);
  if (domain) principals.add(`domain:${domain}`);

  try {
    for (const g of await fetchGroupEmails(key)) principals.add(g);
  } catch (err) {
    // Admin SDK missing/unauthorized — degrade to direct+domain+anyone.
    console.warn("[groups] group expansion failed:", (err as Error).message);
  }

  const result = [...principals];
  CACHE.set(key, { principals: result, expires: now + TTL_MS });
  return result;
}
