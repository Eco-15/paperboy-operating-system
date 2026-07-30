import { execFileSync } from "node:child_process";

// Exports a Google Sheet as CSV, tolerating the local-ADC failure mode.
//
// lib/rag/drive.ts authenticates via ADC, which is what Cloud Run uses and what the
// ingest job relies on. Locally, ADC regularly goes stale with `invalid_rapt` under
// the org's reauth policy, and refreshing it needs an interactive browser login.
//
// The gcloud *user* credential survives that, and it can mint a properly scoped
// token for the paperboy-app service account — which is already an accessor on
// these sheets. So: try ADC first (fast, no subprocess), fall back to an
// impersonated service-account token.

const SERVICE_ACCOUNT = "paperboy-app@paperboy-operating-system.iam.gserviceaccount.com";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

let cachedToken: string | null = null;

/** Mint a drive.readonly token for the service account via the IAM Credentials API. */
function impersonatedToken(): string {
  if (cachedToken) return cachedToken;

  const userToken = execFileSync("gcloud", ["auth", "print-access-token"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (!userToken) {
    throw new Error("`gcloud auth print-access-token` returned nothing — run `gcloud auth login`.");
  }

  // gcloud's own --impersonate-service-account ignores --scopes, so call the API
  // directly to get a token actually scoped for Drive.
  const body = JSON.stringify({ scope: [DRIVE_SCOPE], lifetime: "3600s" });
  const out = execFileSync(
    "curl",
    [
      "-s",
      "-X", "POST",
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${SERVICE_ACCOUNT}:generateAccessToken`,
      "-H", `Authorization: Bearer ${userToken}`,
      "-H", "Content-Type: application/json",
      "-d", body,
    ],
    { encoding: "utf8", maxBuffer: 1 << 20 },
  );

  const parsed = JSON.parse(out) as { accessToken?: string; error?: { message?: string } };
  if (!parsed.accessToken) {
    throw new Error(
      `Could not impersonate ${SERVICE_ACCOUNT}: ${parsed.error?.message ?? out.slice(0, 200)}`,
    );
  }
  cachedToken = parsed.accessToken;
  return cachedToken;
}

async function exportViaToken(fileId: string): Promise<string> {
  const token = impersonatedToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent("text/csv")}&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    throw new Error(`Drive export ${fileId} failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.text();
}

export async function exportSheetCsv(fileId: string): Promise<string> {
  try {
    const { getDriveClient } = await import("../lib/rag/drive");
    const drive = getDriveClient();
    const res = await drive.files.export(
      { fileId, mimeType: "text/csv" },
      { responseType: "text" },
    );
    return String(res.data);
  } catch {
    // ADC stale (invalid_rapt) or unscoped — fall back to the service account.
    return exportViaToken(fileId);
  }
}
