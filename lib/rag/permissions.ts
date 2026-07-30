import { type drive_v3 } from "googleapis";

// Capture the principals allowed to open a Drive file, as stored in
// `drive_file.accessors` and matched against a user's resolved principals
// (see lib/rag/groups.ts). Mirrors that principal vocabulary:
//   user  → email          group → group email
//   domain → `domain:<d>`   anyone → `anyone`
//
// On a Shared Drive most files inherit the drive's membership rather than
// carrying explicit permissions, so ingest also captures the drive's own
// permissions once and unions them in (see lib/rag/ingest.ts).
export async function listAccessors(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<string[]> {
  try {
    const out = new Set<string>();
    let pageToken: string | undefined;
    do {
      const res = await drive.permissions.list({
        fileId,
        supportsAllDrives: true,
        fields: "nextPageToken, permissions(type, emailAddress, domain)",
        pageSize: 100,
        pageToken,
      });
      for (const p of res.data.permissions ?? []) {
        if ((p.type === "user" || p.type === "group") && p.emailAddress) {
          out.add(p.emailAddress.toLowerCase());
        } else if (p.type === "domain" && p.domain) {
          out.add(`domain:${p.domain.toLowerCase()}`);
        } else if (p.type === "anyone") {
          out.add("anyone");
        }
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return [...out];
  } catch (err) {
    // Permission read failed (inherited-only file, or insufficient access). An
    // empty accessors list matches NO principal, so the file becomes invisible to
    // every non-admin — silently. Log it: if this fires for every file, retrieval
    // returns nothing forever while ingest still reports success.
    console.warn(
      `[permissions] could not read accessors for ${fileId} — it will be invisible to non-admins:`,
      (err as Error).message,
    );
    return [];
  }
}
