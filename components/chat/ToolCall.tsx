"use client";

import { useState } from "react";
import type { MessagePart } from "@/lib/chat/types";
import ObjectTable from "./ObjectTable";

type ToolPart = Extract<MessagePart, { kind: "tool" }>;

const VERB: Record<string, string> = {
  query_objects: "Searched",
  get_object: "Fetched",
  ontology_stats: "Computed",
  execute_action: "Ran",
  search_drive: "Searched Drive",
  search_investors: "Searched investors",
  search_blog: "Searched the blog",
  web_search: "Searched the web",
  code_execution: "Built a document",
};

function args(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const o = input as Record<string, unknown>;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === "" || k === "objectType") continue;
    if (typeof v === "object") {
      const inner = Object.entries(v as Record<string, unknown>)
        .map(([ik, iv]) => `${ik}=${String(iv)}`)
        .join(", ");
      if (inner) parts.push(inner);
    } else {
      parts.push(`${k}=${String(v)}`);
    }
  }
  return parts.join(" · ");
}

// One step in the agent's trace. Collapsed by default; expand to see the exact
// arguments and what came back — the thing that makes an agent legible.
export default function ToolCall({
  part,
  onOpenCanvas,
}: {
  part: ToolPart;
  onOpenCanvas: (c: { title: string; objectType?: string; objects?: Record<string, unknown>[]; json?: unknown }) => void;
}) {
  const [open, setOpen] = useState(false);

  const running = !part.done;
  const err = part.result?.isError;
  const verb = VERB[part.tool] ?? part.tool;
  const objectType = (part.input as Record<string, unknown> | undefined)?.objectType as string | undefined;
  const a = args(part.input);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const preview = part.result?.preview as any;
  const objects: Record<string, unknown>[] | undefined =
    preview && Array.isArray(preview.objects) ? preview.objects : undefined;
  const canExpand = !!part.result;

  return (
    <div className={`chat-step${err ? " is-error" : ""}${running ? " is-running" : ""}`}>
      <button
        type="button"
        className="chat-step-head"
        onClick={() => canExpand && setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="chat-step-caret">{canExpand ? (open ? "▾" : "▸") : " "}</span>
        {running && <span className="chat-step-spin" aria-hidden />}
        <span className="chat-step-verb">
          {verb}
          {objectType ? ` ${objectType}` : ""}
        </span>
        {a && <span className="chat-step-args">{a}</span>}
        <span className="chat-step-tail">
          {part.result ? part.result.summary : part.label}
          {part.durationMs != null && !running ? (
            <span className="chat-step-ms"> · {Math.round(part.durationMs)}ms</span>
          ) : null}
        </span>
      </button>

      {open && part.result && (
        <div className="chat-step-body">
          {objects && objectType ? (
            <>
              <ObjectTable objectType={objectType} objects={objects} compact />
              <button
                type="button"
                className="chat-step-expand"
                onClick={() =>
                  onOpenCanvas({
                    title: `${objectType} · ${preview.total ?? objects.length} result${(preview.total ?? objects.length) === 1 ? "" : "s"}`,
                    objectType,
                    objects,
                  })
                }
              >
                Open in panel ↗
              </button>
            </>
          ) : preview !== undefined ? (
            <>
              <pre className="chat-step-json">{JSON.stringify(preview, null, 2).slice(0, 4000)}</pre>
              <button
                type="button"
                className="chat-step-expand"
                onClick={() => onOpenCanvas({ title: verb, json: preview })}
              >
                Open in panel ↗
              </button>
            </>
          ) : (
            <div className="chat-empty-note">{part.result.summary}</div>
          )}
        </div>
      )}
    </div>
  );
}
