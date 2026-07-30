"use client";

// The one text-editing primitive of the Site Editor: an uncontrolled
// contentEditable element. React sets the initial content and never
// reconciles mid-edit (commits happen on blur/Enter). v2 adds:
// - rich mode: renders the inline-markdown subset (**b**, *i*, [l](href)) as
//   real <strong>/<em>/<a> nodes and serializes the DOM back to markdown on
//   commit (see lib/site-content/inlineMarkdown.ts — the round-trip contract).
// - onSplit (Enter splits the paragraph at the caret) and onMergeBack
//   (Backspace at offset 0 merges into the previous paragraph).

import { createElement, useMemo } from "react";
import {
  parseInline,
  serializeDomTrimmed,
  type InlineNode,
} from "@/lib/site-content/inlineMarkdown";

function renderNodes(nodes: InlineNode[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}${i}`;
    if (typeof n === "string") return n;
    if (n.t === "strong")
      return <strong key={key}>{renderNodes(n.kids, `${key}.`)}</strong>;
    if (n.t === "em") return <em key={key}>{renderNodes(n.kids, `${key}.`)}</em>;
    return (
      <a key={key} href={n.href}>
        {renderNodes(n.kids, `${key}.`)}
      </a>
    );
  });
}

// Place the caret at a plain-text offset (or start/end) inside an element.
export function placeCaret(el: HTMLElement, at: number | "start" | "end") {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  if (at === "start") {
    range.selectNodeContents(el);
    range.collapse(true);
  } else if (at === "end") {
    range.selectNodeContents(el);
    range.collapse(false);
  } else {
    let remaining = at;
    let placed = false;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const len = node.nodeValue?.length ?? 0;
      if (remaining <= len) {
        range.setStart(node, Math.max(0, remaining));
        range.collapse(true);
        placed = true;
        break;
      }
      remaining -= len;
      node = walker.nextNode();
    }
    if (!placed) {
      range.selectNodeContents(el);
      range.collapse(false);
    }
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

function caretSplit(el: HTMLElement): { before: string; after: string } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer)) return null;
  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(el);
  beforeRange.setEnd(r.startContainer, r.startOffset);
  const afterRange = document.createRange();
  afterRange.selectNodeContents(el);
  afterRange.setStart(r.endContainer, r.endOffset);
  return {
    before: serializeDomTrimmed(beforeRange.cloneContents()),
    after: serializeDomTrimmed(afterRange.cloneContents()),
  };
}

// Imperative DOM builder for cancel-restore (Escape): rebuilds the element's
// children from the committed value without a React re-render.
function buildDom(nodes: InlineNode[], into: globalThis.Node) {
  for (const n of nodes) {
    if (typeof n === "string") {
      into.appendChild(document.createTextNode(n));
      continue;
    }
    const el =
      n.t === "a"
        ? Object.assign(document.createElement("a"), { href: n.href })
        : document.createElement(n.t === "strong" ? "strong" : "em");
    buildDom(n.kids, el);
    into.appendChild(el);
  }
}

function caretAtStart(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer)) return false;
  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(el);
  beforeRange.setEnd(r.startContainer, r.startOffset);
  return (beforeRange.cloneContents().textContent ?? "") === "";
}

export default function EditableText({
  value,
  onCommit,
  as = "span",
  className,
  placeholder,
  rich,
  onSplit,
  onMergeBack,
  sePath,
}: {
  value: string;
  onCommit: (next: string) => void;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  placeholder?: string;
  rich?: boolean;
  onSplit?: (before: string, after: string) => void;
  onMergeBack?: (currentText: string) => void;
  sePath?: string;
}) {
  const children = useMemo(
    () => (rich ? renderNodes(parseInline(value), "n") : value),
    [rich, value],
  );

  function serialize(el: HTMLElement): string {
    return rich
      ? serializeDomTrimmed(el)
      : (el.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  return createElement(
    as,
    {
      className: ["se-editable", className].filter(Boolean).join(" "),
      contentEditable: true,
      suppressContentEditableWarning: true,
      spellCheck: false,
      "data-placeholder": placeholder,
      "data-rich": rich ? "1" : undefined,
      "data-sepath": sePath,
      onPaste: (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        sel.deleteFromDocument();
        sel.getRangeAt(0).insertNode(document.createTextNode(text));
        sel.collapseToEnd();
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
        const el = e.currentTarget;
        const mod = e.metaKey || e.ctrlKey;
        if (!rich && mod && ["b", "i", "u"].includes(e.key.toLowerCase())) {
          // No formatting in plain fields (headlines, captions).
          e.preventDefault();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          if (onSplit) {
            const split = caretSplit(el);
            if (split) {
              onSplit(split.before, split.after);
              return;
            }
          }
          el.blur();
          return;
        }
        if (e.key === "Backspace" && onMergeBack && caretAtStart(el)) {
          e.preventDefault();
          onMergeBack(serialize(el));
          return;
        }
        if (e.key === "Escape") {
          e.stopPropagation(); // don't also deselect the block
          el.textContent = "";
          if (rich) buildDom(parseInline(value), el);
          else el.textContent = value;
          el.blur();
        }
      },
      onBlur: (e: React.FocusEvent<HTMLElement>) => {
        const next = serialize(e.currentTarget);
        if (next !== value) onCommit(next);
      },
    },
    children,
  );
}
