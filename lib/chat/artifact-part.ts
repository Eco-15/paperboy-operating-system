import type { Artifact, ArtifactKind, MessagePart, ChatMessage } from "./types";

const KINDS: ArtifactKind[] = ["document", "deck", "sheet", "html"];
const ARTIFACT_TOOLS = new Set(["create_artifact", "rewrite_artifact", "update_artifact"]);

// The artifact tools return the saved document on their tool result's `preview`, and
// that lands in the persisted `parts` — which is what lets a document be reopened from
// an old conversation after a reload, without re-asking the model for it.
export function artifactOf(part: MessagePart): Artifact | null {
  if (part.kind !== "tool" || !ARTIFACT_TOOLS.has(part.tool)) return null;
  const a = (part.result?.preview as { artifact?: unknown } | undefined)?.artifact;
  if (!a || typeof a !== "object") return null;

  const o = a as Partial<Artifact>;
  if (!o.id || typeof o.content !== "string" || !o.content.trim()) return null;

  return {
    id: o.id,
    kind: KINDS.includes(o.kind as ArtifactKind) ? (o.kind as ArtifactKind) : "document",
    title: typeof o.title === "string" && o.title ? o.title : "Untitled",
    content: o.content,
    version: typeof o.version === "number" ? o.version : 1,
  };
}

/** The most recent artifact in a message, if any. */
export function latestArtifact(message: ChatMessage | undefined): Artifact | null {
  if (!message?.parts) return null;
  for (let i = message.parts.length - 1; i >= 0; i--) {
    const a = artifactOf(message.parts[i]);
    if (a) return a;
  }
  return null;
}

export const KIND_LABEL: Record<ArtifactKind, string> = {
  document: "Document",
  deck: "Deck",
  sheet: "Spreadsheet",
  html: "Page",
};

export const KIND_ICON: Record<ArtifactKind, string> = {
  document: "▦",
  deck: "▤",
  sheet: "▥",
  html: "◈",
};
