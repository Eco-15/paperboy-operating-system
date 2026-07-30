import type { ModelKey } from "./types";

export type { ModelKey };

// One turn of the conversation, as sent to the model.
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// NOTE (2026-07): the Exia/GLM providers were removed. They had no tools and no
// ontology access, so choosing one silently blinded the assistant to every bit of
// the firm's data while still looking like it was working. Ask Paperboy is now
// Claude-only and always runs the agent loop in lib/chat/agent.ts.
