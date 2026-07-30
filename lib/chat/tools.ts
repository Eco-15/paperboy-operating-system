import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { investors, blogPosts } from "@/lib/db/schema";
import { retrieve, RetrievalError, diagnoseEmptyResult } from "@/lib/rag/retrieval";
import { searchGmail } from "@/lib/google/gmail-search";
import { searchCalendar } from "@/lib/google/calendar-search";
import { searchEverything } from "./federated";
import { getTemplate, listTemplates, TEMPLATE_KEYS } from "@/lib/knowledge/cards";
import { saveArtifact, applyEdits, type ArtifactKind, type Edit } from "@/lib/artifacts/store";
import type { OntologySession } from "@/lib/ontology/auth";

// Appended to every empty search result. A dead end used to be a full stop — the
// model would relay "I couldn't find anything" after ONE narrow guess. This is the
// lesson from the "Paper Invitational" miss: the emails existed, but their subject
// was "Tonight: The Invitational", so the literal phrase matched nothing.
const BROADEN =
  " This is NOT proof the thing doesn't exist — it means this query didn't match. Before telling the " +
  "user it doesn't exist: drop qualifiers and search the single most distinctive word on its own, and " +
  "call search_everything to see which source actually holds it.";

export interface Citation {
  file: string;
  link: string | null;
}
export interface ToolResult {
  content: string;
  citations?: Citation[];
  /** Structured payload for the UI (e.g. a document draft to open in the side panel). */
  preview?: unknown;
}

// JSON-schema tool definitions handed to Claude. `search_drive` is staff-only
// (added conditionally by the agent); the others are safe for any signed-in user.
export const driveToolDef = {
  name: "search_drive",
  description:
    "Search the firm's internal Google Drive knowledge (memos, notes, decks, strategy, deal docs, per-brand cards, and reusable templates). Call this WHENEVER the user references a brand, deal, portfolio company, memo, person, template, or anything that could be written in an internal document — search before answering from memory, and prefer it over guessing.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "What to look for, in plain language" },
      k: {
        type: "number",
        description: "How many passages to return (default 8, max 25). Raise it to dig deeper.",
      },
    },
    required: ["query"],
  },
} as const;

// The house style guides, fetched DETERMINISTICALLY.
//
// They already live in the RAG index, but only reachable by fuzzy semantic search —
// so a "write me a memo" request could silently miss the template and the model would
// invent its own format. Formatting is exactly the thing that must not be left to a
// similarity score.
export const templateToolDef = {
  name: "get_template",
  description:
    "Fetch Paperboy's house TEMPLATE & STYLE GUIDE for a document type — the section-by-section " +
    "(or slide-by-slide) structure reverse-engineered from the firm's own past work. " +
    "Call this BEFORE drafting any memo, deck, agreement or DEALS write-up, so the output matches how " +
    "Paperboy actually writes. Pair it with search_drive for the brand's facts.",
  input_schema: {
    type: "object",
    properties: {
      docType: {
        type: "string",
        enum: [...TEMPLATE_KEYS],
        description:
          "investment-memo = deal/IC memos · investor-deck = pitch decks · " +
          "deals-episode = DEALS newsletter brand write-ups · advisory-agreement = advisory/recruiting contracts",
      },
    },
    required: ["docType"],
  },
} as const;

// ── Artifacts: the document workspace beside the chat ────────────────────────
// The body streams into the panel as the model writes it (lib/chat/agent.ts reads it
// out of the tool's own input deltas), so the user watches it appear rather than
// waiting through a silence.

const KIND_DESC =
  "'document' = memo/agreement/write-up (Markdown) · " +
  "'deck' = slides, one `## ` heading per slide · " +
  "'sheet' = a table/model, as Markdown table or CSV · " +
  "'html' = a self-contained HTML page (styles inline; it renders in a sandbox with no network access)";

export const createArtifactToolDef = {
  name: "create_artifact",
  description:
    "Write a NEW document into the side panel, where the user can read and edit it. Use this for anything " +
    "substantial the user will keep or iterate on: a memo, a deck, a model, a one-pager. " +
    "Call get_template FIRST for memos/decks/agreements so it follows Paperboy's house format. " +
    "Put the whole body in `content` — do NOT also paste it into your reply; just say briefly what you " +
    "made. To change it afterwards, use update_artifact — never re-create it.",
  input_schema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description:
          "A short stable slug, e.g. 'fon-series-a-memo'. Reuse it to revise the same document.",
      },
      kind: { type: "string", enum: ["document", "deck", "sheet", "html"], description: KIND_DESC },
      title: { type: "string", description: "e.g. 'Freaks of Nature — Series A Investment Memo'" },
      content: { type: "string", description: "The full body." },
    },
    required: ["id", "kind", "title", "content"],
  },
} as const;

export const updateArtifactToolDef = {
  name: "update_artifact",
  description:
    "Revise an existing document IN PLACE with targeted find-and-replace edits. Always prefer this over " +
    "rewriting: it's faster, and it leaves the rest of the document — including anything the USER typed " +
    "themselves — untouched. " +
    "The current content is given to you in <open_document>; quote from it EXACTLY, including whitespace. " +
    "Each old_str must appear exactly once — add surrounding context to disambiguate.",
  input_schema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The artifact's id." },
      edits: {
        type: "array",
        description: "Applied in order.",
        items: {
          type: "object",
          properties: {
            old_str: { type: "string", description: "Existing text, quoted exactly. Must be unique." },
            new_str: { type: "string", description: "Replacement (empty string deletes)." },
          },
          required: ["old_str", "new_str"],
        },
      },
    },
    required: ["id", "edits"],
  },
} as const;

export const rewriteArtifactToolDef = {
  name: "rewrite_artifact",
  description:
    "Replace a document's entire body. ONLY for restructures where targeted edits would be absurd (e.g. " +
    "'redo this as a deck'). This DISCARDS any edits the user made, so prefer update_artifact.",
  input_schema: {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      kind: { type: "string", enum: ["document", "deck", "sheet", "html"], description: KIND_DESC },
      content: { type: "string", description: "The full new body." },
    },
    required: ["id", "title", "kind", "content"],
  },
} as const;

export const artifactToolDefs = [
  createArtifactToolDef,
  updateArtifactToolDef,
  rewriteArtifactToolDef,
];

// One query, every surface the caller can read, in parallel. The agent should reach
// for this FIRST whenever it doesn't already know which source holds a thing —
// which is most of the time.
export const federatedToolDef = {
  name: "search_everything",
  description:
    "Search EVERY available source at once — email, calendar, Drive documents, deals, investors, " +
    "contacts, blog posts — and find out where a thing actually lives. Use this FIRST whenever you " +
    "don't already know which source holds the answer, or when a targeted search came back empty. " +
    "It reports which sources matched, how many hits each had, and the top items, so you can then dig " +
    "into the right one with search_gmail / search_drive / query_objects. " +
    "Tip: search the distinctive word on its own ('Invitational') rather than the user's full phrasing " +
    "('the Paper Invitational') — stored titles rarely match how people say them out loud.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The term to look for. Prefer a distinctive keyword over a long exact phrase.",
      },
    },
    required: ["query"],
  },
} as const;

// Live Google tools. Registered for every staff member — including those who have
// NOT connected Google. That's deliberate: if we withheld them, the model wouldn't
// know mail search existed, would fall back to the stale GmailMessage cache, find
// nothing, and announce "I searched your email and found nothing" — which is the
// exact bug these tools exist to fix. Instead they're always present and fail
// loudly at execution with `not_connected`, which the model can relay as an action.
export const googleToolDefs = [
  {
    name: "search_gmail",
    description:
      "Search the user's ENTIRE Gmail mailbox live, including message bodies. This is the AUTHORITATIVE " +
      "way to find or read email — the GmailMessage ontology table is only a small cache of recent " +
      "metadata and must NEVER be used to conclude that an email does not exist. Use this whenever the " +
      "user refers to an email, a sender, a thread, or anything they say they were sent. Supports Gmail's " +
      "full query syntax: from:, to:, subject:, after:YYYY/MM/DD, before:, has:attachment, label:, " +
      '"exact phrase", OR, and -exclusion.',
    input_schema: {
      type: "object",
      properties: {
        q: {
          type: "string",
          description:
            "Gmail search query, e.g. 'Paper Invitational' or 'from:kyle@paperboy.vc after:2026/01/01'",
        },
        maxResults: {
          type: "number",
          description: "How many messages to open and read (default 10, max 25)",
        },
      },
      required: ["q"],
    },
  },
  {
    name: "search_calendar",
    description:
      "Search the user's live Google Calendar over any date range, including the PAST. Use this for any " +
      "question about meetings, availability, or who they met with. The CalendarEvent table only caches a " +
      "window around today, so never conclude a meeting didn't happen without checking here.",
    input_schema: {
      type: "object",
      properties: {
        q: {
          type: "string",
          description: "Free text matched against title, description, location, and attendees",
        },
        timeMin: { type: "string", description: "ISO 8601 start of the window (may be in the past)" },
        timeMax: { type: "string", description: "ISO 8601 end of the window" },
        maxResults: { type: "number", description: "Max events (default 25, max 100)" },
      },
      required: [],
    },
  },
] as const;

export const dataToolDefs = [
  {
    name: "search_investors",
    description:
      "Search the CPG investor database (460 angel groups, VCs, and family offices). Call this whenever the user asks about investors, funds, angel groups, or family offices — by name, investor type, or US state.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name or keyword to match" },
        type: {
          type: "string",
          enum: ["Angel Group", "VC", "Family Office"],
        },
        state: { type: "string", description: "Two-letter US state code, e.g. NY" },
      },
      required: [],
    },
  },
  {
    name: "search_blog",
    description:
      "Search the Paperboy blog ('The Front Page') posts and DEALS episodes. Call this whenever the user asks about published content, articles, or episodes.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword to match (optional)" },
      },
      required: [],
    },
  },
] as const;

function str(input: Record<string, unknown>, key: string): string | undefined {
  const v = input[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: {
    principals: string[];
    isAdmin: boolean;
    userId: string | null;
    session?: OntologySession | null;
    isStaff?: boolean;
    chatId?: string | null;
  },
): Promise<ToolResult> {
  // ── Artifacts ──────────────────────────────────────────────────────────────
  if (name === "create_artifact" || name === "rewrite_artifact") {
    if (!ctx.userId) return { content: "Not signed in — cannot save a document." };
    const id = str(input, "id");
    const title = str(input, "title") ?? "Untitled";
    const kind = (str(input, "kind") ?? "document") as ArtifactKind;
    const content = typeof input.content === "string" ? input.content : "";

    if (!id) return { content: "An artifact needs an `id` (a short stable slug)." };
    if (!content.trim()) return { content: "No content was provided — nothing to write." };

    const saved = await saveArtifact({
      id,
      userId: ctx.userId,
      chatId: ctx.chatId ?? null,
      title,
      kind,
      content,
      authoredBy: "assistant",
    });

    return {
      content:
        `Saved "${title}" (v${saved.version}) — it is open in the panel beside the chat. ` +
        `Do NOT repeat the document in your reply; just say briefly what you made. ` +
        `To change it, use update_artifact with this id.`,
      preview: {
        artifact: { id, kind, title, content, version: saved.version },
      },
    };
  }

  if (name === "update_artifact") {
    if (!ctx.userId) return { content: "Not signed in — cannot edit a document." };
    const id = str(input, "id");
    if (!id) return { content: "update_artifact needs the artifact's `id`." };

    const raw = Array.isArray(input.edits) ? input.edits : [];
    const edits: Edit[] = raw
      .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
      .map((e) => ({
        old_str: typeof e.old_str === "string" ? e.old_str : "",
        new_str: typeof e.new_str === "string" ? e.new_str : "",
      }));

    const res = await applyEdits(id, ctx.userId, edits);

    // A failed edit MUST come back as an error the model can act on. If this returned
    // a cheerful success, the model would tell the user "done!" while the document sat
    // unchanged — the exact way this feature dies.
    if (!res.ok || !res.artifact) {
      return { content: `EDIT FAILED — the document was NOT changed. ${res.error}` };
    }

    const a = res.artifact;
    return {
      content: `Updated "${a.title}" (now v${a.version}). ${edits.length} edit${edits.length === 1 ? "" : "s"} applied.`,
      preview: {
        artifact: { id: a.id, kind: a.kind, title: a.title, content: a.content, version: a.version },
      },
    };
  }

  if (name === "get_template") {
    const docType = str(input, "docType") ?? "";
    const tpl = await getTemplate(docType);

    if (!tpl) {
      // A missing style guide must never read as "there is no house style" — that's how
      // the model ends up quietly inventing its own format.
      const have = await listTemplates();
      return {
        content:
          `No style guide is stored for "${docType}". This does NOT mean Paperboy has no house format — ` +
          `it means the knowledge builder hasn't produced one (it may have found no matching examples in Drive).\n\n` +
          (have.length
            ? `Available: ${have.map((t) => t.key).join(", ")}.\n\n`
            : `No templates are built at all — an admin should run the knowledge-builder job.\n\n`) +
          `Fall back to search_drive for real past examples of this document and follow their structure. ` +
          `Tell the user you're working from examples rather than the stored template.`,
      };
    }

    return {
      content:
        `# Paperboy house format — ${tpl.title}\n\n` +
        `Follow this structure. It was reverse-engineered from the firm's own past documents, so it IS ` +
        `the house style — do not substitute a generic format.\n\n---\n\n${tpl.body}`,
    };
  }

  if (name === "search_everything") {
    const query = str(input, "query") ?? "";
    const res = await searchEverything(query, {
      session: ctx.session ?? null,
      principals: ctx.principals,
      isAdmin: ctx.isAdmin,
      isStaff: !!ctx.isStaff,
      userId: ctx.userId,
    });

    const lines: string[] = [];
    if (res.found.length) {
      lines.push(`Sources with matches for "${res.query}":`);
      for (const s of res.found) {
        lines.push(`\n### ${s.source} — ${s.count} match${s.count === 1 ? "" : "es"}`);
        lines.push(JSON.stringify(s.items, null, 1));
      }
    } else {
      lines.push(`No source matched "${res.query}".${BROADEN}`);
    }
    if (res.empty.length) lines.push(`\nNo matches in: ${res.empty.join(", ")}.`);
    // Surface broken sources loudly — an error is not an absence.
    if (res.failed.length) {
      lines.push(
        `\n⚠️ These sources FAILED (this is an error, not "nothing found" — do not treat them as empty):`,
      );
      for (const f of res.failed) lines.push(`- ${f.source}: ${f.error}`);
    }
    return { content: lines.join("\n") };
  }

  if (name === "search_drive") {
    const query = str(input, "query") ?? "";
    let chunks;
    try {
      chunks = await retrieve(query, {
        principals: ctx.principals,
        isAdmin: ctx.isAdmin,
        k: Math.min(Math.max(Number(input.k) || 8, 1), 25),
      });
    } catch (err) {
      // A broken search is not an empty one. Say which.
      const reason = err instanceof RetrievalError ? err.message : String(err);
      return {
        content:
          `DRIVE SEARCH FAILED — this is an error, not an empty result. Do not tell the user the ` +
          `document doesn't exist. Reason: ${reason}`,
      };
    }

    if (!chunks.length) {
      // Distinguish "never ingested" and "nothing shared with you" from a real miss.
      return {
        content: await diagnoseEmptyResult({
          principals: ctx.principals,
          isAdmin: ctx.isAdmin,
        }),
      };
    }

    const content = chunks
      .map((c, i) => `[${i + 1}] ${c.title ?? c.fileName}\n${c.content}`)
      .join("\n\n");
    // One citation per source file (chunks from the same doc collapse).
    const seen = new Set<string>();
    const citations: Citation[] = [];
    for (const c of chunks) {
      if (seen.has(c.driveFileId)) continue;
      seen.add(c.driveFileId);
      citations.push({ file: c.title ?? c.fileName, link: c.webLink });
    }
    return { content, citations };
  }

  if (name === "search_gmail") {
    if (!ctx.userId) return { content: "No signed-in user — cannot search email." };
    const q = str(input, "q") ?? "";
    const maxResults = Number(input.maxResults) || 10;
    const res = await searchGmail(ctx.userId, q, maxResults);

    if (!res.ok) {
      return {
        content:
          res.code === "not_connected"
            ? "GMAIL NOT CONNECTED — the user has not linked their Google account, so their mailbox " +
              "could not be searched. This is NOT a 'no results' answer: tell them to connect Google " +
              "from the dashboard, then ask again."
            : `GMAIL SEARCH FAILED (${res.code}) — this is an error, not an empty result. Do not say ` +
              `the email doesn't exist. Reason: ${res.message}`,
      };
    }

    if (!res.hits.length) {
      return {
        content:
          `Gmail returned no message matching "${q}". The search itself worked — Gmail simply has ` +
          `nothing for that exact query.` + BROADEN,
      };
    }

    const content = res.hits
      .map(
        (h, i) =>
          `[${i + 1}] ${h.subject ?? "(no subject)"}\n` +
          `From: ${h.from ?? "unknown"}\n` +
          `Date: ${h.date ?? "unknown"}\n` +
          `Object ID: ${h.ontologyId ?? "—"}\n\n${h.body || h.snippet || "(empty body)"}`,
      )
      .join("\n\n---\n\n");

    const header =
      res.estimatedTotal > res.hits.length
        ? `Showing ${res.hits.length} of roughly ${res.estimatedTotal} matching messages.\n\n`
        : "";
    return { content: header + content };
  }

  if (name === "search_calendar") {
    if (!ctx.userId) return { content: "No signed-in user — cannot search the calendar." };
    const res = await searchCalendar(ctx.userId, {
      q: str(input, "q"),
      timeMin: str(input, "timeMin"),
      timeMax: str(input, "timeMax"),
      maxResults: Number(input.maxResults) || undefined,
    });

    if (!res.ok) {
      return {
        content:
          res.code === "not_connected"
            ? "CALENDAR NOT CONNECTED — the user has not linked their Google account. This is NOT a " +
              "'no events' answer: tell them to connect Google from the dashboard, then ask again."
            : `CALENDAR SEARCH FAILED (${res.code}) — an error, not an empty result. Reason: ${res.message}`,
      };
    }

    if (!res.hits.length) {
      return {
        content:
          "No calendar events matched in that window. Note the window: if you didn't pass timeMin/timeMax " +
          "it defaulted to the last year through 90 days out — widen it for anything older." + BROADEN,
      };
    }

    const content = res.hits
      .map((h) => {
        const who = h.attendees.map((a) => a.name ?? a.email).filter(Boolean).join(", ");
        return (
          `${h.start ?? "?"} — ${h.title ?? "(untitled)"}` +
          `${h.location ? ` @ ${h.location}` : ""}` +
          `${who ? `\nAttendees: ${who}` : ""}` +
          `${h.description ? `\n${h.description.slice(0, 500)}` : ""}` +
          `\nObject ID: ${h.ontologyId ?? "—"}`
        );
      })
      .join("\n\n");
    return { content };
  }

  if (name === "search_investors") {
    const query = str(input, "query");
    const type = str(input, "type");
    const state = str(input, "state");
    const conds: SQL[] = [];
    if (query) {
      conds.push(
        or(
          ilike(investors.groupName, `%${query}%`),
          ilike(investors.summary, `%${query}%`),
          ilike(investors.city, `%${query}%`),
        )!,
      );
    }
    if (type) conds.push(eq(investors.type, type));
    if (state) conds.push(ilike(investors.state, state));

    const rows = await db
      .select()
      .from(investors)
      .where(conds.length ? and(...conds) : undefined)
      .limit(25);
    if (!rows.length) return { content: "No investors matched." + BROADEN };
    const content = rows
      .map(
        (r) =>
          `${r.groupName} — ${r.type}${r.city ? `, ${r.city}` : ""}${r.state ? `, ${r.state}` : ""}` +
          `${r.website ? ` (${r.website})` : ""}${r.summary ? `: ${r.summary}` : ""}`,
      )
      .join("\n");
    return { content };
  }

  if (name === "search_blog") {
    const query = str(input, "query");
    const rows = query
      ? await db
          .select()
          .from(blogPosts)
          .where(
            or(
              ilike(blogPosts.title, `%${query}%`),
              ilike(blogPosts.body, `%${query}%`),
            ),
          )
          .limit(10)
      : await db
          .select()
          .from(blogPosts)
          .orderBy(desc(blogPosts.createdAt))
          .limit(10);
    if (!rows.length) return { content: "No blog posts matched." + BROADEN };
    const content = rows
      .map((r) => `${r.title} [${r.category}] — ${r.body}`)
      .join("\n\n");
    return { content };
  }

  return { content: `Unknown tool: ${name}` };
}
