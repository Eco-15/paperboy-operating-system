import Anthropic from "@anthropic-ai/sdk";
import type { ChatTurn } from "./providers";
import {
  driveToolDef,
  dataToolDefs,
  googleToolDefs,
  federatedToolDef,
  templateToolDef,
  artifactToolDefs,
  executeTool,
  type Citation,
} from "./tools";
import { extractStreamingString, isStringComplete } from "./partial-json";
import { buildOntologyToolDefs } from "../ontology/agent/tools";
import { ontologySummary } from "../ontology/agent/prompt";
import { executeOntologyTool, isOntologyTool } from "../ontology/agent/executor";
import type { OntologySession } from "../ontology/auth";

// Structured events the agent streams to the route (forwarded to the client as
// NDJSON). Tool calls carry their id, their INPUT, and their RESULT so the UI can
// render an inspectable step timeline instead of an opaque spinner.
export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_start"; id: string; tool: string; label: string; input?: unknown }
  | {
      type: "tool_end";
      id: string;
      tool: string;
      summary: string;
      preview?: unknown;
      durationMs: number;
      isError?: boolean;
    }
  | {
      type: "proposal";
      id: string;
      action: string;
      params: Record<string, unknown>;
      summary: string;
    }
  | { type: "citations"; citations: Citation[] }
  | { type: "file"; fileId: string; filename: string; mime: string; size: number }
  // The artifact panel, written live from the tool's streaming input.
  | { type: "artifact_start"; id: string; kind: string; title: string }
  | { type: "artifact_delta"; text: string }
  | { type: "artifact_done"; id: string; kind: string; title: string; content: string; version: number }
  | { type: "error"; message: string };

// Tools whose input carries a document body we want to stream into the panel as it's
// written. `update_artifact` is deliberately absent: it emits string EDITS, not a body,
// so there's nothing to type out — it applies at once when the tool runs.
const STREAMS_ARTIFACT = new Set(["create_artifact", "rewrite_artifact"]);

// Actions that only refresh the caller's OWN data — safe to run without a prompt.
// Everything else that mutates firm data goes through an approval card.
const AUTO_RUN_ACTIONS = new Set(["SyncGmail", "SyncCalendar", "SyncDrive", "RefreshNews"]);

function actionSummary(action: string, params: Record<string, unknown>): string {
  const p = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
  return p ? `${action} · ${p}` : action;
}

// Turn an ontology tool's JSON result into a one-liner + a small inspectable preview.
function summarizeOntology(
  tool: string,
  input: Record<string, unknown>,
  raw: string,
): { summary: string; preview?: unknown; isError?: boolean } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let p: any;
  try {
    p = JSON.parse(raw);
  } catch {
    return { summary: raw.slice(0, 140) };
  }
  if (p?.error) return { summary: String(p.error), isError: true };

  switch (tool) {
    case "query_objects": {
      const t = String(input.objectType ?? "objects");
      const f = input.filters as Record<string, string> | undefined;
      const fs = f && Object.keys(f).length
        ? " · " + Object.entries(f).map(([k, v]) => `${k}=${v}`).join(", ")
        : "";
      const total = p.total ?? p.objects?.length ?? 0;
      return {
        summary: `${t}${fs} → ${total} result${total === 1 ? "" : "s"}`,
        preview: { objectType: t, total, objects: (p.objects ?? []).slice(0, 8) },
      };
    }
    case "get_object":
      return {
        summary: `${input.objectType} · ${String(input.id ?? "")}`,
        preview: { objectType: input.objectType, objects: p.object ? [p.object] : [] },
      };
    case "ontology_stats":
      return { summary: String(input.function ?? ""), preview: p.result };
    case "execute_action":
      return { summary: `${input.action} → ${p.ok ? "done" : "failed"}`, preview: p, isError: !p.ok };
    default:
      return { summary: "done", preview: p };
  }
}

function legacySummary(
  tool: string,
  input: Record<string, unknown>,
  r: { content: string; citations?: Citation[] },
): string {
  const q = String(input.query ?? input.q ?? "");
  if (tool === "search_drive") {
    const n = r.citations?.length ?? 0;
    return q ? `“${q}” → ${n} document${n === 1 ? "" : "s"}` : `${n} documents`;
  }
  // Gmail/Calendar summaries are the tool-chip caption, which IS persisted — so
  // they carry counts and the query only, never any message content.
  if (tool === "search_gmail" || tool === "search_calendar") {
    if (/^(GMAIL|CALENDAR) (NOT CONNECTED|SEARCH FAILED)/.test(r.content)) {
      return tool === "search_gmail" ? "Gmail unavailable" : "Calendar unavailable";
    }
    const n = (r.content.match(/^\[\d+\]/gm) ?? r.content.match(/^\d{4}-/gm) ?? []).length;
    const est = /roughly (\d+) matching/.exec(r.content)?.[1];
    const count = est ? `${n} of ~${est}` : `${n}`;
    const noun = tool === "search_gmail" ? "message" : "event";
    return q ? `“${q}” → ${count} ${noun}${n === 1 && !est ? "" : "s"}` : `${count} ${noun}s`;
  }
  let n: number | undefined;
  try {
    const p = JSON.parse(r.content);
    if (Array.isArray(p)) n = p.length;
    else if (Array.isArray(p?.results)) n = p.results.length;
  } catch {
    /* plain text result */
  }
  const count = n !== undefined ? ` → ${n} result${n === 1 ? "" : "s"}` : "";
  return q ? `“${q}”${count}` : count.replace(" → ", "") || "done";
}

// Human-readable status shown on a tool chip while the agent works.
function toolLabel(tool: string): string {
  switch (tool) {
    case "search_everything":
      return "Searching everywhere…";
    case "get_template":
      return "Reading the house format…";
    case "create_artifact":
      return "Writing the document…";
    case "rewrite_artifact":
      return "Rewriting the document…";
    case "update_artifact":
      return "Revising the document…";
    case "distinct_values":
      return "Checking real values…";
    case "search_drive":
      return "Searching Drive…";
    case "search_gmail":
      return "Searching Gmail…";
    case "search_calendar":
      return "Searching calendar…";
    case "search_investors":
      return "Searching investors…";
    case "search_blog":
      return "Searching the blog…";
    case "web_search":
      return "Searching the web…";
    case "code_execution":
      return "Building document…";
    case "query_objects":
      return "Querying ontology…";
    case "get_object":
      return "Fetching object…";
    case "execute_action":
      return "Executing action…";
    case "ontology_stats":
      return "Computing stats…";
    default:
      return "Working…";
  }
}

export function agentSystemPrompt(includeDrive: boolean, includeGoogle = false): string {
  return [
    "You are Paperboy, the in-house AI assistant for Paperboy Ventures, a consumer-brand investment firm.",
    "You have tools to look things up. Answer directly for small talk; use a tool whenever real data would make the answer better.",
    "",
    ontologySummary(),
    "",
    [
      "<search_protocol>",
      "A zero-result search is a HYPOTHESIS THAT FAILED, not an answer. Never tell the user something",
      "doesn't exist because your first query missed — that is the single most common way you can be wrong.",
      "",
      "How people ask ≠ how things are stored. A user saying \"the Paper Invitational\" is looking for emails",
      "titled \"Tonight: The Invitational\". A literal search for their exact phrasing finds nothing.",
      "",
      "When you don't know where something lives, or a search comes back empty, escalate — don't give up:",
      "1. Use `search_everything` — it queries email, calendar, Drive and every object type AT ONCE and tells",
      "   you which ones matched. This is almost always the right FIRST move for a vague or unfamiliar term.",
      "2. Strip the query down to its single most distinctive word ('Invitational', not 'the Paper Invitational').",
      "3. Prefer `search` (matches all text fields) over `filters` (one exact field).",
      "4. Before filtering on a category/stage/type you're unsure of, call `distinct_values` to see what really exists.",
      "5. Go to the authoritative live source: `search_gmail` for mail, `search_calendar` for meetings.",
      "",
      "Only say you couldn't find something after the bare, distinctive term has come back empty from the",
      "authoritative source. And if a tool reports an ERROR or NOT CONNECTED, say exactly that — never",
      "translate a failure into \"I couldn't find anything\".",
      "</search_protocol>",
    ].join("\n"),
    "Use the ontology tools (query_objects, get_object, distinct_values, execute_action, ontology_stats) as your PRIMARY structured data layer.",
    includeGoogle
      ? [
          "<email_and_calendar>",
          "The user's email and calendar live in Google, NOT in the ontology. search_gmail and search_calendar query their real mailbox and calendar and are the ONLY authoritative sources.",
          "- For ANY question about an email, a sender, a thread, or something the user says they were sent: call search_gmail. It searches the whole mailbox including message bodies.",
          "- For ANY question about meetings, availability, or who they met: call search_calendar. It can look into the past.",
          "- The GmailMessage and CalendarEvent object types are small partial caches. NEVER use a zero-result query_objects on them to conclude that an email or meeting does not exist — search the live source first.",
          "- Do NOT run the SyncGmail/SyncCalendar actions to look something up; they only refresh a small cache. Use the search tools.",
          "- If a search tool reports NOT CONNECTED or FAILED, that is an error, not an empty result. Tell the user exactly what's wrong (e.g. that they need to connect Google) — never report it as 'I couldn't find anything'.",
          "</email_and_calendar>",
        ].join("\n")
      : "",
    "Fall back to the legacy tools (search_drive, search_investors, search_blog) when needed:",
    includeDrive
      ? "- search_drive: the firm's internal knowledge — per-brand deal cards, document content, and reusable templates/playbooks (e.g. the investment-memo template & style guide)."
      : "",
    "- search_investors: the CPG investor database (supports text search + type/state filters — prefer query_objects for structured queries).",
    "- search_blog: the firm's published blog posts (prefer query_objects for structured queries).",
    "- web_search: the live web, for current or outside information.",
    includeDrive
      ? [
          "<search_first>",
          "For anything that could be written in an internal document — a brand, a deal, a portfolio company, a memo, a person, a template, firm strategy or process — call search_drive BEFORE answering from memory. When a request is research-shaped (\"what do we know about…\", \"pull together…\", \"summarize our…\"), begin searching immediately rather than asking a scoping question. Use search_investors for investor questions and web_search for current or outside information. Ground your answer in what the tools return, and don't claim internal facts you didn't retrieve.",
          "</search_first>",
        ].join("\n")
      : "Prefer the internal tools for internal questions; use web_search for current events or anything not in your own data.",
    includeDrive
      ? [
          "<house_style>",
          "Paperboy has its OWN format for the documents it produces, reverse-engineered from the firm's",
          "past work and stored as style guides. Matching that format is the whole point — a well-written",
          "memo in the wrong shape is a failure.",
          "",
          "So whenever you are asked to write, draft, structure or outline a memo, deck, pitch, agreement or",
          "DEALS write-up:",
          "1. Call `get_template` FIRST, with the matching docType. Do not skip this and do not rely on",
          "   search_drive to surface the template — it is a similarity search and it can miss.",
          "2. Gather the FACTS: search_drive for the brand's documents and card, and query_objects for the",
          "   Deal. Never invent a figure; if something is missing, mark it [TBD] rather than guessing.",
          "3. Draft following the template's section (or slide) order exactly.",
          "",
          "If `get_template` reports no stored guide, say so plainly, work from real past examples found via",
          "search_drive, and tell the user that's what you did. Never silently substitute a generic format.",
          "</house_style>",
        ].join("\n")
      : "",
    includeDrive
      ? [
          "<documents>",
          "There is a DOCUMENT PANEL beside the chat. Anything substantial the user will keep, read properly",
          "or iterate on — a memo, a deck, a model, a one-pager — belongs there, NOT in the transcript.",
          "",
          "- `create_artifact` writes a new document into the panel. The body streams in as you write it, so",
          "  the user watches it appear. Put the WHOLE body in `content` and do NOT also paste it into your",
          "  reply — that would just print it twice. Say briefly what you made and what you'd change next.",
          "- `update_artifact` revises it IN PLACE with find-and-replace edits. Always prefer this over",
          "  rewriting: it's faster, and it preserves everything the USER typed themselves.",
          "- The document's CURRENT text — including the user's own edits — is given to you in",
          "  <open_document>. That, not your memory of what you wrote, is the truth. Quote from it exactly.",
          "- If an edit fails to match, the document did NOT change. Say so and retry against the real text;",
          "  never claim you changed something you didn't.",
          "",
          "Short answers, lists, and direct replies still belong in the chat. Don't put a two-line answer in a",
          "document. Reach for the panel when the thing IS a document.",
          "",
          "Separately, you can build real FILES — .pptx / .docx / .xlsx / PDF — by writing and running code.",
          "Do that when the user asks to export or download, not by default.",
          "</documents>",
        ].join("\n")
      : "",
    "Cite the documents and investors you relied on. Format answers in clean Markdown (headings, lists, tables, and fenced code where useful). Be concise and direct.",
  ]
    .filter(Boolean)
    .join("\n");
}

// Streaming Claude tool-use loop. Yields structured events: text/thinking
// deltas, tool-status start/end, and collected citations. Executes the custom
// tools (Drive/investors/blog) when Claude calls them and lets the server-side
// web_search run on Anthropic's side.
export async function* runAgent(opts: {
  messages: ChatTurn[];
  system: string;
  /** Drive ACL principals (email + groups + domain). RAG-only — NOT an identity. */
  principals: string[];
  isAdmin: boolean;
  includeDrive: boolean;
  /** Offer the live Gmail/Calendar search tools (staff). Registered even when the
   *  user hasn't connected Google — the tool then fails loudly, which is far better
   *  than the model not knowing mail search exists and reporting a false "not found". */
  includeGoogle: boolean;
  /** The real signed-in identity: users.id (UUID) + role. Drives ALL ontology access. */
  session: OntologySession | null;
  /** Where an artifact created this turn was born. */
  chatId?: string | null;
}): AsyncGenerator<AgentEvent> {
  const client = new Anthropic();
  // Staff get the full toolkit: Drive RAG + document skills (code execution).
  // web_search must be the BASIC variant here — the _20260209 variant runs its
  // own hidden code-execution environment that collides with the skills one.
  const includeSkills = opts.includeDrive;

  // Scoped to the caller's role: the schemas only expose object types and actions
  // this user may actually use (the executor re-checks anyway).
  const ontologyToolDefs = buildOntologyToolDefs(opts.session);
  const googleTools = opts.includeGoogle ? googleToolDefs : [];

  const tools = (
    includeSkills
      ? [
          federatedToolDef,
          driveToolDef,
          templateToolDef,
          ...artifactToolDefs,
          ...googleTools,
          ...dataToolDefs,
          ...ontologyToolDefs,
          { type: "web_search_20250305", name: "web_search" },
          { type: "code_execution_20260521", name: "code_execution" },
        ]
      : [
          federatedToolDef,
          ...googleTools,
          ...dataToolDefs,
          ...ontologyToolDefs,
          { type: "web_search_20260209", name: "web_search" },
        ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;

  const convo: Anthropic.MessageParam[] = opts.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const citations: Citation[] = [];
  const seenFiles = new Set<string>();

  // Room to actually investigate: escalating through search_everything → a narrowed
  // term → the live source is several round-trips, and a server-side web_search
  // `pause_turn` burns a slot on its own. Bounded by the route's 300s maxDuration.
  const MAX_TURNS = 14;
  // True if we fell out of the loop while the model still wanted to call tools —
  // i.e. it never got to write an answer. Left unhandled, the stream just ends and
  // the user receives an EMPTY message.
  let ranOutOfTurns = false;

  for (let i = 0; i < MAX_TURNS; i++) {
    // Beta path (staff) adds the document skills + code execution; both paths
    // stream the same event shapes. Typed loosely to bridge beta/non-beta.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream: any = includeSkills
      ? client.beta.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 32000,
          thinking: { type: "adaptive", display: "summarized" },
          betas: [
            "code-execution-2025-08-25",
            "skills-2025-10-02",
            "files-api-2025-04-14",
          ],
          container: {
            skills: [
              { type: "anthropic", skill_id: "pptx", version: "latest" },
              { type: "anthropic", skill_id: "docx", version: "latest" },
              { type: "anthropic", skill_id: "xlsx", version: "latest" },
              { type: "anthropic", skill_id: "pdf", version: "latest" },
            ],
          },
          system: opts.system,
          tools,
          messages: convo,
        })
      : client.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 8192,
          // Opus 4.8 omits thinking text by default — request the readable
          // summary so the "thinking" chip has content.
          thinking: { type: "adaptive", display: "summarized" },
          system: opts.system,
          tools,
          messages: convo,
        });

    // Server-side tool blocks (web_search / code_execution) run on Anthropic's
    // side — we only see start/stop, so we time them by block index. Client tools
    // (ours) emit tool_start at EXECUTION time instead, where the full input is
    // known, so the card can show exactly what was searched.
    const openServer = new Map<number, { id: string; name: string; at: number }>();

    // An artifact's body arrives inside a tool's INPUT, which the API streams as
    // `input_json_delta` fragments. Those deltas used to be dropped, so writing a
    // 3,000-word memo looked like a long silence followed by a document appearing
    // fully formed. Buffer the partial JSON per block and read the body out of it as
    // it grows — that's what makes the panel write itself.
    const openArtifact = new Map<
      number,
      { name: string; buf: string; sentTitle: boolean; sent: number }
    >();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const ev of stream as AsyncIterable<any>) {
      if (ev.type === "content_block_start") {
        const cb = ev.content_block;
        if (cb.type === "server_tool_use") {
          const id = cb.id ?? `srv_${i}_${ev.index}`;
          openServer.set(ev.index, { id, name: cb.name, at: Date.now() });
          yield { type: "tool_start", id, tool: cb.name, label: toolLabel(cb.name) };
        } else if (cb.type === "tool_use" && STREAMS_ARTIFACT.has(cb.name)) {
          openArtifact.set(ev.index, { name: cb.name, buf: "", sentTitle: false, sent: 0 });
        }
      } else if (ev.type === "content_block_delta") {
        if (ev.delta.type === "text_delta") {
          yield { type: "text", text: ev.delta.text };
        } else if (ev.delta.type === "thinking_delta") {
          yield { type: "thinking", text: ev.delta.thinking };
        } else if (ev.delta.type === "input_json_delta") {
          const a = openArtifact.get(ev.index);
          if (a) {
            a.buf += ev.delta.partial_json ?? "";

            // Open the panel as soon as we know what's being written — before a single
            // word of the body exists — so the user sees it start, not finish.
            if (!a.sentTitle) {
              const id = extractStreamingString(a.buf, "id");
              const kind = extractStreamingString(a.buf, "kind");
              const title = extractStreamingString(a.buf, "title");
              if (id && kind && title && isStringComplete(a.buf, "title")) {
                a.sentTitle = true;
                yield { type: "artifact_start", id, kind, title };
              }
            }

            // Emit only what's NEW — the client appends, so re-sending the whole body
            // every delta would be O(n²) over the wire and make the panel flicker.
            const body = extractStreamingString(a.buf, "content");
            if (a.sentTitle && body !== null && body.length > a.sent) {
              yield { type: "artifact_delta", text: body.slice(a.sent) };
              a.sent = body.length;
            }
          }
        }
      } else if (ev.type === "content_block_stop") {
        openArtifact.delete(ev.index);
        const s = openServer.get(ev.index);
        if (s) {
          openServer.delete(ev.index);
          yield {
            type: "tool_end",
            id: s.id,
            tool: s.name,
            summary: s.name === "web_search" ? "searched the web" : "ran code",
            durationMs: Date.now() - s.at,
          };
        }
      }
    }

    const final = await stream.finalMessage();
    convo.push({
      role: "assistant",
      content: final.content as unknown as Anthropic.ContentBlockParam[],
    });

    // Capture files produced by the document skills (code execution outputs).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const block of (final.content as any[]) ?? []) {
      if (block?.type !== "bash_code_execution_tool_result") continue;
      const outs = block.content?.content;
      if (!Array.isArray(outs)) continue;
      for (const o of outs) {
        if (o?.type !== "bash_code_execution_output" || !o.file_id) continue;
        if (seenFiles.has(o.file_id)) continue;
        seenFiles.add(o.file_id);
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const meta: any = await client.beta.files.retrieveMetadata(o.file_id, {
            betas: ["files-api-2025-04-14"],
          });
          yield {
            type: "file",
            fileId: o.file_id,
            filename: meta.filename ?? "document",
            mime: meta.mime_type ?? "application/octet-stream",
            size: meta.size_bytes ?? 0,
          };
        } catch {
          /* metadata unavailable — skip this file */
        }
      }
    }

    if (final.stop_reason === "tool_use") {
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of final.content) {
        if (block.type !== "tool_use") continue;
        const input = (block.input ?? {}) as Record<string, unknown>;

        // ── Writes need the user's OK ──────────────────────────────────────
        // Surface the change as an approval card instead of applying it. The
        // model is told it was NOT applied so it doesn't retry or claim success.
        if (
          block.name === "execute_action" &&
          !AUTO_RUN_ACTIONS.has(String(input.action ?? ""))
        ) {
          const action = String(input.action ?? "");
          const params = (input.params ?? {}) as Record<string, unknown>;
          yield {
            type: "proposal",
            id: block.id,
            action,
            params,
            summary: actionSummary(action, params),
          };
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({
              status: "awaiting_user_approval",
              note: "NOT applied. This change was shown to the user as an approval card; they must confirm it. Do not call execute_action for it again — briefly tell them what you're proposing and that it's waiting on their approval.",
            }),
          });
          continue;
        }

        const started = Date.now();
        yield {
          type: "tool_start",
          id: block.id,
          tool: block.name,
          label: toolLabel(block.name),
          input,
        };

        let summary = "done";
        let preview: unknown;
        let isError = false;

        if (isOntologyTool(block.name)) {
          // Route to the ontology executor under the REAL signed-in identity.
          // (This used to pass principals[0] — an email — as user.id, which
          // silently broke every owner-scoped read and every staff write.)
          const content = await executeOntologyTool(block.name, input, {
            session: opts.session,
          });
          const s = summarizeOntology(block.name, input, content);
          summary = s.summary;
          preview = s.preview;
          isError = !!s.isError;
          results.push({ type: "tool_result", tool_use_id: block.id, content });
        } else {
          // A throw here used to escape runAgent entirely and kill the stream — the
          // user got "The model didn't respond", which is both alarming and wrong.
          // Hand the error back as a tool result so the model can route around it.
          try {
            const r = await executeTool(block.name, input, {
              principals: opts.principals,
              isAdmin: opts.isAdmin,
              userId: opts.session?.user?.id ?? null,
              session: opts.session,
              isStaff: opts.includeGoogle,
              chatId: opts.chatId ?? null,
            });
            if (r.citations) citations.push(...r.citations);
            summary = legacySummary(block.name, input, r);
            // A tool's own structured preview (e.g. a document draft for the side
            // panel) takes precedence over the citation chips.
            preview = r.preview ?? (r.citations?.length ? { citations: r.citations } : undefined);
            results.push({ type: "tool_result", tool_use_id: block.id, content: r.content });
          } catch (e) {
            const msg = (e as Error).message;
            summary = msg.slice(0, 140);
            isError = true;
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `Tool ${block.name} FAILED: ${msg}. This is an error, not an empty result — do not tell the user the thing doesn't exist. Try another source.`,
            });
          }
        }

        yield {
          type: "tool_end",
          id: block.id,
          tool: block.name,
          summary,
          preview,
          durationMs: Date.now() - started,
          isError,
        };
      }
      convo.push({ role: "user", content: results });
      // It still wants tools but this was the last turn — it will never write an
      // answer. Fall through to the synthesis pass rather than ending in silence.
      if (i === MAX_TURNS - 1) ranOutOfTurns = true;
      continue;
    }

    if (final.stop_reason === "pause_turn") {
      // Server-side web_search hit the loop limit — re-send to resume.
      if (i === MAX_TURNS - 1) ranOutOfTurns = true;
      continue;
    }

    break; // end_turn / max_tokens / refusal
  }

  // Out of turns mid-investigation. Make one final call with NO tools so the model
  // has to answer from what it already gathered. Without this the generator simply
  // returns and the user gets an empty assistant message.
  if (ranOutOfTurns) {
    try {
      const wrapUp = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 4096,
        system:
          opts.system +
          "\n\nYou have run out of tool calls for this turn. Answer NOW using only what you already " +
          "found. Say plainly what you learned, what you could not confirm, and what you'd check next. " +
          "Do not claim something doesn't exist merely because you ran out of steps.",
        messages: convo,
      });
      for (const block of wrapUp.content) {
        if (block.type === "text") yield { type: "text", text: block.text };
      }
    } catch {
      yield {
        type: "error",
        message:
          "I ran out of search steps before I could finish. Try narrowing the question and asking again.",
      };
    }
  }

  if (citations.length) {
    // Dedupe by file + link so the Sources footer isn't repetitive.
    const seen = new Set<string>();
    const deduped = citations.filter((c) => {
      const key = `${c.file}|${c.link ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    yield { type: "citations", citations: deduped };
  }
}
