// ── Live Gmail search ─────────────────────────────────────────────────────────
// Searches the signed-in user's REAL mailbox through their own OAuth token, rather
// than the `gmail_message` table — which only ever holds the ~50 newest messages,
// metadata-only. Gmail's `q` is already a full-text engine over the whole mailbox
// (bodies included), always current, and permission-correct by construction, so we
// use it as the recall layer and keep the ontology as the representation layer.
//
// Hits are upserted as METADATA ONLY, so they gain a stable ontology ID (entity
// chips, deep links) without turning our database into a copy of the user's email.
// Bodies are returned to the caller for the model to read, and never persisted.

import type { gmail_v1 } from "googleapis";
import { db } from "@/lib/db";
import { gmailMessages } from "@/lib/db/schema";
import { getGoogleClientForUser } from "./user-client";

/** Cap on extracted body text per message, to keep a long thread from eating the context window. */
const MAX_BODY = 20_000;
/** Concurrent messages.get calls. Gmail's per-user rate limit is generous; this is politeness. */
const FETCH_CONCURRENCY = 5;

export interface GmailHit {
  /** gmail_message.id — the ontology handle, for deep links and get_object. */
  ontologyId: string | null;
  gmailId: string;
  threadId: string | null;
  subject: string | null;
  from: string | null;
  to: string[];
  date: string | null;
  snippet: string | null;
  /** Extracted plaintext. Never written to the database. */
  body: string;
}

export type GmailSearchResult =
  | { ok: true; hits: GmailHit[]; estimatedTotal: number }
  | {
      ok: false;
      /** Distinct causes, so the caller can never render a failure as "no results". */
      code: "not_connected" | "reconnect" | "rate_limited" | "error";
      message: string;
    };

// ── MIME body extraction ─────────────────────────────────────────────────────

type Part = gmail_v1.Schema$MessagePart;
type Header = gmail_v1.Schema$MessagePartHeader;

function header(headers: Header[] | undefined, name: string): string | null {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null
  );
}

function decodePart(data: string, headers: Header[] | undefined): string {
  // Gmail encodes with base64URL (`-`/`_`, padding often dropped). Node decodes
  // that natively — hand-rolling the `+`/`/` swap is where this usually goes wrong.
  const buf = Buffer.from(data, "base64url");
  const charset = /charset=["']?([\w-]+)/i.exec(header(headers, "content-type") ?? "")?.[1];
  try {
    return new TextDecoder(charset || "utf-8").decode(buf);
  } catch {
    // TextDecoder throws on charset labels it doesn't know (e.g. some legacy ones).
    return buf.toString("utf8");
  }
}

function htmlToText(html: string): string {
  return html
    // Strip script/style *bodies* first — otherwise removing tags alone leaves raw
    // CSS and JS in the text, which is what the model would then try to read.
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)));
}

// Depth-first walk collecting text/plain and text/html into separate buckets. Doing
// it this way means multipart/alternative and multipart/mixed both fall out
// naturally, with no special-casing of container mime types.
function walk(part: Part | undefined, plain: string[], html: string[]): void {
  if (!part) return;

  const disposition = header(part.headers ?? undefined, "content-disposition") ?? "";
  const isAttachment = !!part.filename || /^attachment/i.test(disposition);

  if (!isAttachment && part.body?.data) {
    const text = decodePart(part.body.data, part.headers ?? undefined);
    if (part.mimeType === "text/plain") plain.push(text);
    else if (part.mimeType === "text/html") html.push(text);
  }

  for (const child of part.parts ?? []) walk(child, plain, html);
}

export function extractBody(payload: Part | undefined): string {
  const plain: string[] = [];
  const html: string[] = [];
  walk(payload, plain, html); // also covers the simple non-multipart case
  const text = plain.length ? plain.join("\n") : htmlToText(html.join("\n"));
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_BODY);
}

// ── Search ───────────────────────────────────────────────────────────────────

/** Turn a Google API error into a cause the model can act on and relay to the user. */
function classify(err: unknown): Extract<GmailSearchResult, { ok: false }> {
  const e = err as { code?: number; status?: number; message?: string };
  const status = e.status ?? e.code;
  const message = e.message ?? String(err);

  if (status === 401 || /invalid_grant/i.test(message)) {
    return {
      ok: false,
      code: "reconnect",
      message: "The user's Google authorization has expired. They need to reconnect Google.",
    };
  }
  if (status === 403 && /insufficient|scope/i.test(message)) {
    return {
      ok: false,
      code: "reconnect",
      message: "The Google connection is missing the Gmail scope. The user needs to reconnect Google.",
    };
  }
  if (status === 429 || /rateLimit|quota/i.test(message)) {
    return { ok: false, code: "rate_limited", message: "Gmail rate-limited the request. Try again shortly." };
  }
  return { ok: false, code: "error", message };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/**
 * Search the user's entire live mailbox.
 *
 * @param q Gmail query syntax — plain terms, or operators like `from:`,
 *          `subject:`, `after:YYYY/MM/DD`, `has:attachment`, `"exact phrase"`.
 */
export async function searchGmail(
  userId: string,
  q: string,
  maxResults = 10,
): Promise<GmailSearchResult> {
  if (!q.trim()) {
    return { ok: false, code: "error", message: "Empty search query." };
  }

  const client = await getGoogleClientForUser(userId);
  if (!client) {
    return {
      ok: false,
      code: "not_connected",
      message:
        "This user has not connected their Google account, so their mailbox cannot be searched at all.",
    };
  }

  try {
    const { google } = await import("googleapis");
    const gmail = google.gmail({ version: "v1", auth: client });

    const list = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: Math.min(Math.max(maxResults, 1), 25),
    });

    const ids = (list.data.messages ?? [])
      .map((m) => m.id)
      .filter((id): id is string => !!id);

    if (!ids.length) {
      return { ok: true, hits: [], estimatedTotal: 0 };
    }

    const hits = await mapWithConcurrency(ids, FETCH_CONCURRENCY, async (id) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      });
      const d = detail.data;
      const headers = d.payload?.headers ?? undefined;
      const toRaw = header(headers, "To");
      const dateRaw = header(headers, "Date");
      const parsedDate = dateRaw ? new Date(dateRaw) : null;
      const date = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;

      // Upsert metadata only — the body stays out of the database on purpose.
      // `.returning()` gives us the ontology UUID so the UI can link to the object.
      const labels = d.labelIds ?? [];
      const ccRaw = header(headers, "Cc");
      const [row] = await db
        .insert(gmailMessages)
        .values({
          gmailId: id,
          userId,
          threadId: d.threadId ?? null,
          subject: header(headers, "Subject"),
          from: header(headers, "From"),
          to: toRaw ? toRaw.split(",").map((s) => s.trim()) : [],
          cc: ccRaw ? ccRaw.split(",").map((s) => s.trim()) : [],
          snippet: d.snippet ?? null,
          isRead: !labels.includes("UNREAD"),
          labels,
          date,
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: gmailMessages.gmailId,
          set: {
            snippet: d.snippet ?? null,
            isRead: !labels.includes("UNREAD"),
            labels,
            syncedAt: new Date(),
          },
        })
        .returning({ id: gmailMessages.id });

      return {
        ontologyId: row?.id ?? null,
        gmailId: id,
        threadId: d.threadId ?? null,
        subject: header(headers, "Subject"),
        from: header(headers, "From"),
        to: toRaw ? toRaw.split(",").map((s) => s.trim()) : [],
        date: date?.toISOString() ?? null,
        snippet: d.snippet ?? null,
        body: extractBody(d.payload ?? undefined),
      } satisfies GmailHit;
    });

    return {
      ok: true,
      hits,
      // Gmail's own estimate over the WHOLE mailbox, not just the page we fetched.
      estimatedTotal: list.data.resultSizeEstimate ?? hits.length,
    };
  } catch (err) {
    console.error("[gmail-search] failed:", err);
    return classify(err);
  }
}
