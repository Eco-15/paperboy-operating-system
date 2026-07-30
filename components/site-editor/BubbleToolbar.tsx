"use client";

// Wix-style floating formatting bubble: appears over a non-collapsed text
// selection inside a rich editable (.se-editable[data-rich]) and applies
// bold / italic / link. Formatting is persisted as the inline-markdown subset
// when the field commits on blur (see EditableText/inlineMarkdown).

import { useEffect, useRef, useState } from "react";

// One seam around the deprecated-but-universal execCommand API.
function applyInlineCommand(cmd: "bold" | "italic" | "createLink" | "unlink", arg?: string) {
  document.execCommand(cmd, false, arg);
}

type BubbleState = {
  top: number;
  left: number;
  bold: boolean;
  italic: boolean;
  linked: boolean;
};

function richHost(node: Node | null): HTMLElement | null {
  let el: HTMLElement | null =
    node instanceof HTMLElement ? node : (node?.parentElement ?? null);
  while (el) {
    if (el.classList?.contains("se-editable") && el.dataset.rich === "1") return el;
    el = el.parentElement;
  }
  return null;
}

export default function BubbleToolbar() {
  const [state, setState] = useState<BubbleState | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const bubbleRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    function update() {
      const sel = window.getSelection();
      if (
        !sel ||
        sel.rangeCount === 0 ||
        sel.isCollapsed ||
        !richHost(sel.anchorNode)
      ) {
        // Keep the bubble while interacting with it (e.g. typing a link href).
        if (document.activeElement && bubbleRef.current?.contains(document.activeElement)) {
          return;
        }
        setState(null);
        setLinkOpen(false);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      setState({
        top: rect.top - 44,
        left: rect.left + rect.width / 2,
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        linked: document.queryCommandState("unlink"),
      });
    }
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  if (!state) return null;

  function restoreSelection() {
    const range = savedRangeRef.current;
    if (!range) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function applyLink() {
    restoreSelection();
    const target = href.trim();
    if (target) applyInlineCommand("createLink", target);
    setLinkOpen(false);
    setHref("");
  }

  return (
    <div
      ref={bubbleRef}
      className="se-bubble"
      style={{ top: state.top, left: state.left }}
      // preventDefault keeps the text selection alive while clicking buttons
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault();
      }}
    >
      <button
        type="button"
        className={`se-bubble-btn${state.bold ? " se-bubble-btn--active" : ""}`}
        title="Bold (⌘B)"
        onClick={() => applyInlineCommand("bold")}
      >
        B
      </button>
      <button
        type="button"
        className={`se-bubble-btn se-bubble-btn--i${state.italic ? " se-bubble-btn--active" : ""}`}
        title="Italic (⌘I)"
        onClick={() => applyInlineCommand("italic")}
      >
        I
      </button>
      <button
        type="button"
        className="se-bubble-btn"
        title="Link the selected text"
        onClick={() => setLinkOpen((v) => !v)}
      >
        🔗
      </button>
      <button
        type="button"
        className="se-bubble-btn"
        title="Remove link"
        onClick={() => {
          restoreSelection();
          applyInlineCommand("unlink");
        }}
      >
        ⛓️‍💥
      </button>
      {linkOpen ? (
        <span className="se-bubble-link">
          <input
            autoFocus
            placeholder="/portfolio or https://…"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
            }}
          />
          <button type="button" className="se-bubble-btn" onClick={applyLink}>
            ✓
          </button>
        </span>
      ) : null}
    </div>
  );
}
