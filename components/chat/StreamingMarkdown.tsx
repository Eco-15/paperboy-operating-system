"use client";

import { memo, useMemo } from "react";
import { Markdown } from "./Markdown";

// ── Why this exists ──────────────────────────────────────────────────────────
// The old code passed the ENTIRE growing message to <Markdown> on every commit, so
// remark + rehype + highlight.js re-parsed the whole string ~25×/second. Cost per
// commit is O(length), which makes a message O(n²) to stream: the longer the reply,
// the slower each frame, until the tail arrives in big ugly jerks.
//
// Markdown is block-structured, and a block that is already followed by a blank line
// can never change. So: parse the settled blocks ONCE (memoized on their stable
// string), and re-parse only the short live tail each frame. Per-frame work becomes
// O(tail) — flat, regardless of how long the answer gets.
//
// The tail is inherently approximate mid-block (a half-written table is just pipes
// until its delimiter row lands). That's why `done` exists: once streaming ends we
// render the whole message through the normal <Markdown> path, so the FINAL output is
// always exactly what plain markdown would produce. The fast path is only ever the
// transient view.

const FENCE = /^\s*(```|~~~)/;
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s/;
const TABLE_ROW = /^\s*\|/;

/** Blocks that a following blank line does NOT necessarily terminate. */
function blockKind(block: string): "list" | "table" | "other" {
  const first = block.split("\n", 1)[0] ?? "";
  if (LIST_ITEM.test(first)) return "list";
  if (TABLE_ROW.test(first)) return "table";
  return "other";
}

/**
 * Split into settled blocks + the still-growing tail.
 * Fence-aware: a blank line inside ``` is not a boundary.
 */
export function splitStreamingBlocks(text: string): { blocks: string[]; tail: string } {
  const lines = text.split("\n");

  let inFence = false;
  let lastBoundary = -1; // index of the last blank line at fence depth 0

  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    // `i < lines.length - 1` is load-bearing. "foo\n".split("\n") is ["foo", ""], and
    // that trailing "" is NOT a blank line — it's the artifact of a single newline,
    // which in markdown is a soft break *inside* the current block. Treating it as a
    // boundary froze blocks that were still growing: a table's header row settled
    // before its delimiter row arrived, so it rendered as literal pipes and then
    // snapped into a <table> — the exact jerk this component exists to prevent.
    if (!inFence && lines[i].trim() === "" && i < lines.length - 1) lastBoundary = i;
  }

  // An unterminated fence means everything from it onward is still in flux.
  if (inFence) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (FENCE.test(lines[i])) {
        lastBoundary = Math.min(lastBoundary, i - 1);
        break;
      }
    }
  }

  if (lastBoundary < 0) return { blocks: [], tail: text };

  const settled = lines.slice(0, lastBoundary).join("\n");
  const tail = lines.slice(lastBoundary + 1).join("\n");

  // Group settled lines into blocks at blank lines, then re-merge adjacent list or
  // table blocks. Markdown treats `- a\n\n- b` as ONE loose list; splitting it would
  // emit two <ul>s and the spacing would visibly shift when the final render lands.
  const raw = settled
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const blocks: string[] = [];
  for (const b of raw) {
    const prev = blocks[blocks.length - 1];
    const kind = blockKind(b);
    if (prev && kind !== "other" && blockKind(prev) === kind) {
      blocks[blocks.length - 1] = `${prev}\n\n${b}`;
    } else {
      blocks.push(b);
    }
  }

  return { blocks, tail };
}

function StreamingMarkdownBase({
  text,
  done = false,
  caret = false,
}: {
  text: string;
  /** Stream finished — render the whole thing the normal way, exactly once. */
  done?: boolean;
  caret?: boolean;
}) {
  const { blocks, tail } = useMemo(
    () => (done ? { blocks: [], tail: "" } : splitStreamingBlocks(text)),
    [text, done],
  );

  if (done) return <Markdown>{text}</Markdown>;

  return (
    <div className="chat-md">
      {blocks.map((b, i) => (
        // Key by index: blocks only ever APPEND, so index is stable, and the memo on
        // <Markdown> then makes each block parse exactly once for the whole stream.
        <Markdown key={i} bare highlight>
          {b}
        </Markdown>
      ))}
      {tail.trim() ? (
        <Markdown bare highlight={false}>
          {tail}
        </Markdown>
      ) : null}
      {/* Inline, so it can't be knocked onto its own line when block structure changes. */}
      {caret ? <span className="chat-typing">▍</span> : null}
    </div>
  );
}

export const StreamingMarkdown = memo(StreamingMarkdownBase);
export default StreamingMarkdown;
