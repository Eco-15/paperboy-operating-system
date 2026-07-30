"use client";

import { useState } from "react";
import Markdown from "./Markdown";
import StreamingMarkdown from "./StreamingMarkdown";
import ToolCall from "./ToolCall";
import { artifactOf, KIND_LABEL, KIND_ICON } from "@/lib/chat/artifact-part";
import type { Artifact } from "@/lib/chat/types";
import ProposalCard from "./ProposalCard";
import type { CanvasContent } from "./Canvas";
import type { ChatMessage } from "@/lib/chat/types";

function fileIcon(mime: string, name: string): string {
  const n = name.toLowerCase();
  if (mime.includes("presentation") || n.endsWith(".pptx")) return "▤";
  if (mime.includes("sheet") || n.endsWith(".xlsx")) return "▦";
  if (mime.includes("word") || n.endsWith(".docx")) return "▧";
  if (mime.includes("pdf") || n.endsWith(".pdf")) return "▥";
  return "▢";
}
function formatSize(n: number): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function Thinking({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="chat-think">
      <button type="button" className="chat-think-head" onClick={() => setOpen((o) => !o)}>
        <span className="chat-step-caret">{open ? "▾" : "▸"}</span> Thought it through
      </button>
      {open && <div className="chat-think-body">{text}</div>}
    </div>
  );
}

// An assistant turn is an ORDERED list of parts, so the tools the agent ran appear
// exactly where it ran them — interleaved with what it said.
export default function MessageParts({
  message,
  streaming,
  onOpenCanvas,
  onDecide,
  onOpenArtifact,
}: {
  message: ChatMessage;
  streaming: boolean;
  onOpenCanvas: (c: CanvasContent) => void;
  onDecide: (messageId: string, proposalId: string, decision: "approve" | "deny") => Promise<void>;
  onOpenArtifact?: (a: Artifact) => void;
}) {
  const parts = message.parts ?? [];

  // Older messages (pre-trace) only have flat text.
  if (parts.length === 0) {
    return message.text ? (
      <Markdown>{message.text}</Markdown>
    ) : streaming ? (
      <span className="chat-typing">▍</span>
    ) : null;
  }

  // Only the LAST text part is still growing; earlier ones are settled and must not
  // pay the streaming code path.
  const lastTextIdx = parts.reduce((acc, p, i) => (p.kind === "text" ? i : acc), -1);

  return (
    <>
      {parts.map((p, i) => {
        switch (p.kind) {
          case "text": {
            if (!p.text.trim()) return null;
            const isLive = streaming && i === lastTextIdx;
            // StreamingMarkdown parses settled blocks once and only re-parses the
            // short tail; when done it renders the whole message the normal way, so
            // the final output is exactly plain markdown.
            return (
              <StreamingMarkdown key={i} text={p.text} done={!isLive} caret={isLive} />
            );
          }
          case "thinking":
            return p.text.trim() ? <Thinking key={i} text={p.text} /> : null;
          case "tool": {
            // A document is the ANSWER, not a debug step — surface it as a card rather
            // than hiding it inside a collapsed tool row. Clicking it reopens the real
            // artifact (persisted in `parts`), so an old conversation's document still
            // opens after a reload.
            const art = artifactOf(p);
            if (art) {
              return (
                <button
                  key={p.id}
                  type="button"
                  className="chat-doc-card"
                  onClick={() => onOpenArtifact?.(art)}
                >
                  <span className="chat-doc-card-icon" aria-hidden>
                    {KIND_ICON[art.kind]}
                  </span>
                  <span className="chat-doc-card-meta">
                    <span className="chat-doc-card-title">{art.title}</span>
                    <span className="chat-doc-card-sub">
                      {KIND_LABEL[art.kind]} · v{art.version}
                    </span>
                  </span>
                  <span className="chat-doc-card-open">Open ↗</span>
                </button>
              );
            }
            return <ToolCall key={p.id} part={p} onOpenCanvas={onOpenCanvas} />;
          }
          case "proposal":
            return (
              <ProposalCard key={p.id} part={p} messageId={message.id} onDecide={onDecide} />
            );
          case "file":
            return (
              <a key={p.fileId} className="chat-file-card" href={`/api/chat/files/${p.fileId}`}>
                <span className="chat-file-icon" aria-hidden>
                  {fileIcon(p.mime, p.filename)}
                </span>
                <span className="chat-file-meta">
                  <span className="chat-file-name">{p.filename}</span>
                  <span className="chat-file-size">{formatSize(p.size)}</span>
                </span>
                <span className="chat-file-dl">Download</span>
              </a>
            );
          default:
            return null;
        }
      })}
      {/* The caret normally lives INLINE at the end of the streaming text (so it can't
          be bumped onto its own line when block structure changes). Only show a
          standalone one when there's no live text yet — e.g. mid tool-call. */}
      {streaming && lastTextIdx === -1 && <span className="chat-typing">▍</span>}
    </>
  );
}
