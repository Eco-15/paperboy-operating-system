import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inquiries } from "@/lib/db/schema";

// Squarespace → OS intake. The public paperboyventures.com "brand application"
// forms still live on Squarespace; this endpoint lets them land directly in
// the CRM pipeline (inquiries → origin "form") instead of a Google Sheet.
// Wire-up options are documented in ops/squarespace-intake.md — either a
// code-injection fetch on the Squarespace form or a Zapier/Make webhook step.
//
// Unauthenticated callers are rejected: the shared token must arrive as
// ?token=… or an x-intake-token header, and the route fails CLOSED when
// INTAKE_WEBHOOK_SECRET isn't configured.

// Squarespace names its custom form fields `SQF_<LABEL>` (upper snake, derived
// from the visible label) while native fields are fname/lname/email — and a
// Zapier step in between may send yet another casing. Normalize both the
// incoming keys and our alias lists so "SQF_BRAND_NAME", "brand_name" and
// "brandName" all resolve to the same field.
function normalizeKey(key: string): string {
  return key
    .replace(/^sqf[_-]?/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// `SQF_BRAND_STAGE` → "Brand stage" — used to label the fields we don't map to
// a column, so nothing Kyle asked on the form is silently dropped.
function prettyLabel(key: string): string {
  const words = key.replace(/^SQF[_-]?/i, "").replace(/[_-]+/g, " ").trim();
  const spaced = words.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

type Field = { key: string; value: string };

function indexBody(body: Record<string, unknown>): Map<string, Field> {
  const idx = new Map<string, Field>();
  for (const [key, raw] of Object.entries(body)) {
    // Squarespace sends checkbox groups / multi-selects as arrays.
    const value = Array.isArray(raw)
      ? raw.filter((v) => typeof v === "string").join(", ")
      : typeof raw === "string"
        ? raw
        : typeof raw === "number" || typeof raw === "boolean"
          ? String(raw)
          : "";
    if (!value.trim()) continue;
    const norm = normalizeKey(key);
    if (!norm || idx.has(norm)) continue;
    idx.set(norm, { key, value: value.trim() });
  }
  return idx;
}

// Pulls the first matching alias and marks it consumed, so leftovers can be
// appended to the message verbatim.
function take(
  idx: Map<string, Field>,
  used: Set<string>,
  aliases: string[],
): string | null {
  for (const alias of aliases) {
    const norm = normalizeKey(alias);
    const hit = idx.get(norm);
    if (hit) {
      used.add(norm);
      return hit.value;
    }
  }
  return null;
}

// Squarespace/Zapier plumbing fields that would only be noise in the CRM.
const IGNORED = new Set(
  [
    "formid",
    "collectionid",
    "objectname",
    "submissionid",
    "captcha",
    "gcaptcha",
    "recaptcha",
    "company_website", // the /apply honeypot, if the same markup is reused
  ].map(normalizeKey),
);

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const j = await req.json();
      return j && typeof j === "object" ? (j as Record<string, unknown>) : null;
    }
    if (type.includes("form")) {
      const fd = await req.formData();
      const out: Record<string, unknown> = {};
      fd.forEach((v, k) => {
        if (typeof v === "string") out[k] = v;
      });
      return out;
    }
    // Fallback for `navigator.sendBeacon`, which must send text/plain to stay a
    // CORS-simple request (an application/json beacon needs a preflight that
    // never completes during page unload — the submission would be dropped).
    const text = (await req.text()).trim();
    if (!text) return null;
    if (text.startsWith("{")) {
      const j = JSON.parse(text);
      return j && typeof j === "object" ? (j as Record<string, unknown>) : null;
    }
    const out: Record<string, unknown> = {};
    new URLSearchParams(text).forEach((v, k) => {
      out[k] = v;
    });
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-intake-token",
  "Access-Control-Max-Age": "86400",
};

// The browser preflights a cross-origin fetch from squarespace.com whenever the
// snippet sends JSON headers. Auth is the token, not the origin, so allow it.
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const secret = process.env.INTAKE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Intake not configured" }, { status: 503 });
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-intake-token");
  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const idx = indexBody(body);
  const used = new Set<string>();

  const company = take(idx, used, ["company", "brand", "brandName", "businessName"]);
  const emailAddr = take(idx, used, ["email", "emailAddress"]);
  if (!company && !emailAddr) {
    return NextResponse.json({ error: "Need at least a company or email" }, { status: 400 });
  }

  const fullName = take(idx, used, ["name", "fullName", "yourName", "contact", "contactName"]);
  const firstName =
    take(idx, used, ["firstName", "fname"]) ?? fullName?.split(/\s+/)[0] ?? "—";
  const lastName =
    take(idx, used, ["lastName", "lname"]) ??
    (fullName ? fullName.split(/\s+/).slice(1).join(" ") || null : null);
  const website = take(idx, used, ["website", "url", "site", "webAddress"]);
  const deck = take(idx, used, ["deck", "deckLink", "pitchdeck", "pitchDeck", "dataRoom"]);
  const message = take(idx, used, ["message", "pitch", "about", "notes", "details"]);

  // Everything else Kyle asks on the form (category, raise, revenue, socials…)
  // rides along in the message rather than being dropped on the floor.
  const extras = [...idx.entries()]
    .filter(([norm]) => !used.has(norm) && !IGNORED.has(norm))
    .map(([, f]) => `${prettyLabel(f.key)}: ${f.value}`);

  const header = [
    "Source: Squarespace brand application",
    website ? `Website: ${website}` : null,
    deck ? `Deck: ${deck}` : null,
    ...extras,
  ]
    .filter(Boolean)
    .join("\n");

  await db.insert(inquiries).values({
    type: "founder",
    firstName: firstName.slice(0, 200),
    lastName: lastName ? lastName.slice(0, 200) : null,
    email: (emailAddr ?? "unknown@paperboyventures.com").slice(0, 320),
    company: company ? company.slice(0, 200) : null,
    deckName: deck ? deck.slice(0, 500) : null,
    message: [header, message ?? ""].filter(Boolean).join("\n\n").slice(0, 8000),
  });

  return NextResponse.json({ ok: true }, { headers: CORS });
}
