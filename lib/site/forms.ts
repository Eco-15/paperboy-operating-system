import { z } from "zod";
import { NextResponse } from "next/server";

// Shared plumbing for the public marketing forms (/apply, /jobs, /deals).
// These endpoints are unauthenticated by design; the honeypot is the spam
// gate — bots that fill the hidden field get a cheerful 200 and no insert.

export const HONEYPOT_FIELD = "company_website"; // hidden input, humans leave it empty

export const email = z.string().trim().email().max(320);
export const shortText = z.string().trim().min(1).max(200);
export const longText = z.string().trim().min(1).max(5000);

export function isHoneypotTripped(body: Record<string, unknown>): boolean {
  const v = body?.[HONEYPOT_FIELD];
  return typeof v === "string" && v.trim().length > 0;
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function ok() {
  return NextResponse.json({ ok: true });
}

export function badRequest(error: z.ZodError | string) {
  const fields =
    typeof error === "string"
      ? { form: error }
      : Object.fromEntries(
          error.issues.map((i) => [i.path.join(".") || "form", i.message]),
        );
  return NextResponse.json({ ok: false, fields }, { status: 400 });
}
