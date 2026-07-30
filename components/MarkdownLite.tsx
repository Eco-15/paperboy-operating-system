import type { ReactNode } from "react";

// Minimal, dependency-free markdown rendering (headings, bullets, bold,
// paragraphs) shared by the Brand Library cards and the CRM one-pager memo.
// No raw HTML — everything is React nodes; styling comes from .mdlite-* CSS.

function renderInline(text: string, key: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={key + i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={key + i}>{p}</span>
    ),
  );
}

export function renderMarkdownLite(md: string, { skipH1 = true } = {}): ReactNode[] {
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = (k: string) => {
    if (list.length) {
      out.push(
        <ul key={k} className="mdlite-ul">
          {list}
        </ul>,
      );
      list = [];
    }
  };
  md.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^###\s/.test(line)) {
      flush("f" + i);
      out.push(<h4 key={i} className="mdlite-h4">{renderInline(line.replace(/^###\s/, ""), "h" + i)}</h4>);
    } else if (/^##\s/.test(line)) {
      flush("f" + i);
      out.push(<h3 key={i} className="mdlite-h3">{renderInline(line.replace(/^##\s/, ""), "h" + i)}</h3>);
    } else if (/^#\s/.test(line)) {
      flush("f" + i);
      // Top-level title is usually shown separately in a header.
      if (!skipH1) {
        out.push(<h2 key={i} className="mdlite-h2">{renderInline(line.replace(/^#\s/, ""), "h" + i)}</h2>);
      }
    } else if (/^[-*•]\s/.test(line)) {
      list.push(<li key={i}>{renderInline(line.replace(/^[-*•]\s/, ""), "l" + i)}</li>);
    } else if (line.trim() === "") {
      flush("f" + i);
    } else {
      flush("f" + i);
      out.push(<p key={i} className="mdlite-p">{renderInline(line, "p" + i)}</p>);
    }
  });
  flush("end");
  return out;
}

export default function MarkdownLite({ md, skipH1 = true }: { md: string; skipH1?: boolean }) {
  return <div className="mdlite">{renderMarkdownLite(md, { skipH1 })}</div>;
}
