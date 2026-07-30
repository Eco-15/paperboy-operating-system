import { google } from "googleapis";

// Read-only Calendar + Gmail. Restricted/sensitive scopes — the OAuth consent
// screen must list these and the app should be "Internal" (Workspace).
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

// The dashboard connect flow reuses the staff-sign-in OAuth client
// (GOOGLE_OAUTH_ID/SECRET) but with its own callback path — that path must be
// added to the client's Authorized redirect URIs in the Google console.
export function appBaseUrl(): string {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function googleRedirectUri(): string {
  return `${appBaseUrl()}/api/google/callback`;
}

export function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_ID,
    process.env.GOOGLE_OAUTH_SECRET,
    googleRedirectUri(),
  );
}

export function consentUrl(state: string, loginHint?: string): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline", // get a refresh_token
    prompt: "consent", // force it even on re-connect
    scope: GOOGLE_SCOPES,
    include_granted_scopes: true,
    state,
    login_hint: loginHint,
  });
}
