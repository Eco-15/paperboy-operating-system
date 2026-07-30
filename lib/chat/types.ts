// A cited source surfaced by a tool (Drive doc, etc.).
export interface Citation {
  file: string;
  link: string | null;
}

// A file the agent generated (PowerPoint/Word/Excel/PDF) and archived.
export interface FileRef {
  fileId: string;
  filename: string;
  mime: string;
  size: number;
}

// A document built beside the chat. The body streams in as the model writes it, the
// user can edit it, and it persists in the library independent of this conversation.
export type ArtifactKind = "document" | "deck" | "sheet" | "html";

export interface Artifact {
  id: string;
  kind: ArtifactKind;
  title: string;
  content: string;
  version: number;
  /** True while the body is still streaming in. */
  streaming?: boolean;
}

// What a tool call returned, shaped for display.
export interface ToolResult {
  /** One-line human summary, e.g. "Deal · stage=Diligence → 12 results". */
  summary: string;
  /** Small structured preview (e.g. first rows) the UI can table/inspect. */
  preview?: unknown;
  isError?: boolean;
}

// ── Message parts ────────────────────────────────────────────────────────────
// An assistant turn is an ORDERED list of parts, so the UI can interleave text
// with the tools the agent ran (like an IDE agent), and replay it after reload.
export type MessagePart =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string }
  | {
      kind: "tool";
      id: string;
      tool: string;
      label: string;
      input?: unknown;
      result?: ToolResult;
      durationMs?: number;
      /** false while still running (streaming only). */
      done?: boolean;
    }
  | {
      kind: "proposal";
      id: string;
      action: string;
      params: Record<string, unknown>;
      summary: string;
      status: "pending" | "approved" | "denied" | "failed";
      result?: unknown;
      error?: string;
    }
  | { kind: "file"; fileId: string; filename: string; mime: string; size: number };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: string;
  parts?: MessagePart[];
  citations?: Citation[];
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  updated: string;
}

// NDJSON events streamed by /api/chat (mirrors the server AgentEvent + "done").
export type StreamEvent =
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
  | { type: "artifact_start"; id: string; kind: ArtifactKind; title: string }
  | { type: "artifact_delta"; text: string }
  | { type: "file"; fileId: string; filename: string; mime: string; size: number }
  | { type: "error"; message: string }
  | { type: "done"; messageId?: string };

// One-shot handoff: the floating Ask bar stashes a message here, /chat sends it.
export const PENDING_LS_KEY = "paperboyChatPending";

// Claude-only: Exia/GLM have no tools and no ontology access — a model picker
// that silently blinds the assistant to all of the firm's data is a footgun.
export type ModelKey = "claude";
