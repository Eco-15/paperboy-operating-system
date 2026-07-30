"use client";

import { memo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import markdown from "highlight.js/lib/languages/markdown";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";

// Curated highlight.js subset — keeps the bundle small; each grammar registers
// its own aliases (js→javascript, ts→typescript, html→xml, sh→bash, …).
const languages = {
  javascript,
  typescript,
  python,
  json,
  bash,
  sql,
  markdown,
  xml,
  css,
};

// Fenced code with a copy button — table stakes for a dev-grade chat.
function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text =
      typeof children === "string"
        ? children
        : // The <pre> wraps a <code> element whose children hold the raw text.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          String((children as any)?.props?.children ?? "");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="chat-code">
      <button type="button" className="chat-code-copy" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

// Open every link in a new tab, safely.
const components: Components = {
  a({ node, ...props }) {
    return <a target="_blank" rel="noopener noreferrer" {...props} />;
  },
  pre({ children }) {
    return <CodeBlock>{children}</CodeBlock>;
  },
};

// `highlight` is off for the still-streaming tail: highlight.js is the most
// expensive step in the pipeline, and re-running it on a half-written code fence
// every frame buys nothing — the fence gets highlighted the moment it closes and
// becomes a stable block. `bare` drops the .chat-md wrapper so StreamingMarkdown
// can emit many blocks inside ONE wrapper (nested wrappers would double the
// vertical rhythm).
function MarkdownBase({
  children,
  highlight = true,
  bare = false,
}: {
  children: string;
  highlight?: boolean;
  bare?: boolean;
}) {
  const md = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={highlight ? [[rehypeHighlight, { languages, ignoreMissing: true }]] : []}
      components={components}
    >
      {children}
    </ReactMarkdown>
  );
  return bare ? md : <div className="chat-md">{md}</div>;
}

// Memoized so completed blocks don't re-parse when the streaming tail updates.
// This memo is load-bearing: StreamingMarkdown feeds it stable, unchanging strings.
export const Markdown = memo(MarkdownBase);
export default Markdown;
