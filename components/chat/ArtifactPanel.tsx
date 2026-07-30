"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "./Markdown";
import StreamingMarkdown from "./StreamingMarkdown";
import type { Artifact } from "@/lib/chat/types";

// ── Deck ─────────────────────────────────────────────────────────────────────
function toSlides(markdown: string): { title: string; body: string }[] {
  return markdown
    .split(/\n(?=##\s)/)
    .map((chunk) => {
      const [first, ...rest] = chunk.split("\n");
      return { title: first.replace(/^#+\s*/, "").trim(), body: rest.join("\n").trim() };
    })
    .filter((s) => s.title || s.body);
}

// ── Sheet ────────────────────────────────────────────────────────────────────
// The model writes a markdown table or CSV. Parse either into a grid — asking it for
// a bespoke JSON shape just invites malformed output for no benefit.
function toGrid(src: string): string[][] {
  const lines = src.trim().split("\n").filter((l) => l.trim());
  const isMd = lines[0]?.includes("|");

  return lines
    .filter((l) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(l) || !isMd) // drop the ---|--- rule
    .map((line) =>
      isMd
        ? line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim())
        : // Minimal CSV: honours quoted fields containing commas.
          (line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? [])
            .map((c) => c.replace(/,$/, "").trim().replace(/^"|"$/g, "").replace(/""/g, '"'))
            .slice(0, -1 || undefined),
    )
    .filter((row) => row.some((c) => c !== ""));
}

function SheetView({ content }: { content: string }) {
  const rows = useMemo(() => toGrid(content), [content]);
  if (!rows.length) return null;
  const [head, ...body] = rows;
  return (
    <div className="chat-sheet-wrap">
      <table className="chat-sheet">
        <thead>
          <tr>
            {head.map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── HTML ─────────────────────────────────────────────────────────────────────
// Model-authored HTML is untrusted. `sandbox="allow-scripts"` WITHOUT
// `allow-same-origin` is load-bearing: granting both together lets the frame reach the
// parent origin — session cookies, the whole OS — which would turn a generated page
// into account takeover. Scripts run, but in an opaque origin with no access to us.
// (No allow-forms / allow-popups / allow-top-navigation either.)
function HtmlView({ content }: { content: string }) {
  return (
    <iframe
      className="chat-html-frame"
      sandbox="allow-scripts"
      srcDoc={content}
      title="Preview"
      referrerPolicy="no-referrer"
    />
  );
}

export default function ArtifactPanel({
  artifact,
  onClose,
  onEdit,
  onExport,
}: {
  artifact: Artifact;
  onClose: () => void;
  onEdit: (content: string) => void;
  onExport: (format: "pptx" | "docx" | "xlsx" | "html") => void;
}) {
  const [mode, setMode] = useState<"preview" | "source">("preview");
  const [exporting, setExporting] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // While the model is writing, force preview — the user can't sensibly edit a moving
  // target, and dropping them into a source view mid-stream is disorienting.
  useEffect(() => {
    if (artifact.streaming) setMode("preview");
  }, [artifact.streaming]);

  useEffect(() => setExporting(false), [artifact.id]);

  const exportFormat =
    artifact.kind === "deck" ? "pptx" : artifact.kind === "sheet" ? "xlsx" : artifact.kind === "html" ? "html" : "docx";

  const doExport = () => {
    setExporting(true);
    onExport(exportFormat);
  };

  const slides = artifact.kind === "deck" && mode === "preview" ? toSlides(artifact.content) : [];

  return (
    <aside className="chat-canvas">
      <div className="chat-canvas-head">
        <span className="chat-canvas-title" title={artifact.title}>
          {artifact.title}
        </span>
        {artifact.version > 0 && !artifact.streaming && (
          <span className="chat-canvas-ver">v{artifact.version}</span>
        )}
        <button type="button" className="chat-canvas-close" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      <div className="chat-doc-actions">
        <div className="chat-seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "preview"}
            className={mode === "preview" ? "is-on" : ""}
            onClick={() => setMode("preview")}
          >
            Preview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "source"}
            className={mode === "source" ? "is-on" : ""}
            onClick={() => setMode("source")}
            disabled={artifact.streaming}
          >
            Edit
          </button>
        </div>

        <button
          type="button"
          className="chat-doc-btn"
          onClick={doExport}
          disabled={exporting || artifact.streaming}
        >
          {exporting ? "Building…" : `Export .${exportFormat}`}
        </button>
        <button
          type="button"
          className="chat-doc-btn chat-doc-btn--ghost"
          onClick={() => void navigator.clipboard.writeText(artifact.content)}
        >
          Copy
        </button>
      </div>

      <div className="chat-canvas-body">
        {mode === "source" ? (
          <textarea
            ref={taRef}
            className="chat-doc-source"
            value={artifact.content}
            spellCheck={false}
            onChange={(e) => onEdit(e.target.value)}
            aria-label="Document source"
          />
        ) : artifact.kind === "html" ? (
          <HtmlView content={artifact.content} />
        ) : artifact.kind === "sheet" ? (
          <SheetView content={artifact.content} />
        ) : artifact.kind === "deck" ? (
          <div className="chat-slides">
            {slides.map((s, i) => (
              <section className="chat-slide" key={i}>
                <div className="chat-slide-num">{i + 1}</div>
                <h3 className="chat-slide-title">{s.title}</h3>
                {s.body ? <Markdown>{s.body}</Markdown> : null}
              </section>
            ))}
          </div>
        ) : (
          // Reuses the chat's streaming renderer: settled blocks parse once, only the
          // live tail re-parses, so a long memo streams in without the panel juddering.
          <article className="chat-doc-body">
            <StreamingMarkdown
              text={artifact.content}
              done={!artifact.streaming}
              caret={!!artifact.streaming}
            />
          </article>
        )}
      </div>
    </aside>
  );
}
