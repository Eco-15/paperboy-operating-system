import type { ReactNode } from "react";

// Dependency-free, server-safe markdown renderer for OS-authored blog posts,
// emitting the SAME markup/classes as the legacy press Block renderer so DB
// posts are indistinguishable from the imported Squarespace ones. Also powers
// the OS editor's live preview (wrapped in .site scope) — keep them in sync.
//
// Supported: ## headings, > quotes, ![alt](src) images (own line), -/* and
// 1. lists, paragraphs with **bold**, *italic*, [text](href); first paragraph
// gets the fp-dropcap treatment.

type Inline = ReactNode[];

function renderInline(text: string, key: string): Inline {
  // Split out links first, then bold/italic inside each plain segment.
  const out: ReactNode[] = [];
  const linkRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  const pushText = (t: string) => {
    t.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).forEach((p) => {
      if (!p) return;
      if (p.startsWith("**") && p.endsWith("**")) {
        out.push(<strong key={`${key}-${i++}`}>{p.slice(2, -2)}</strong>);
      } else if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
        out.push(<em key={`${key}-${i++}`}>{p.slice(1, -1)}</em>);
      } else {
        out.push(<span key={`${key}-${i++}`}>{p}</span>);
      }
    });
  };
  while ((m = linkRe.exec(text)) !== null) {
    if (m.index > last) pushText(text.slice(last, m.index));
    out.push(
      <a key={`${key}-${i++}`} href={m[2]} target="_blank" rel="noopener noreferrer">
        {m[1]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) pushText(text.slice(last));
  return out;
}

export default function PressMarkdown({ md }: { md: string }) {
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: ReactNode[] } | null = null;
  let quote: string[] = [];
  let sawFirstP = false;

  const flushList = (k: string) => {
    if (!list) return;
    out.push(
      list.ordered ? (
        <ol key={k}>{list.items}</ol>
      ) : (
        <ul key={k}>{list.items}</ul>
      ),
    );
    list = null;
  };
  const flushQuote = (k: string) => {
    if (!quote.length) return;
    out.push(
      <blockquote key={k} className="site-quote">
        {renderInline(quote.join(" "), k)}
      </blockquote>,
    );
    quote = [];
  };
  const flushAll = (k: string) => {
    flushList(`${k}-l`);
    flushQuote(`${k}-q`);
  };

  md.split("\n").forEach((raw, idx) => {
    const line = raw.trimEnd();
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line.trim());
    if (img) {
      flushAll(`f${idx}`);
      out.push(
        <figure key={idx} className="site-photo site-article-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img[2]} alt={img[1]} />
        </figure>,
      );
    } else if (/^#{1,3}\s/.test(line)) {
      flushAll(`f${idx}`);
      out.push(
        <h2 key={idx} className="site-subhead">
          {renderInline(line.replace(/^#{1,3}\s/, ""), `h${idx}`)}
        </h2>,
      );
    } else if (/^>\s?/.test(line)) {
      flushList(`f${idx}`);
      quote.push(line.replace(/^>\s?/, ""));
    } else if (/^[-*]\s/.test(line)) {
      flushQuote(`f${idx}`);
      if (!list || list.ordered) flushList(`f${idx}b`);
      list ??= { ordered: false, items: [] };
      list.items.push(
        <li key={idx}>{renderInline(line.replace(/^[-*]\s/, ""), `l${idx}`)}</li>,
      );
    } else if (/^\d+\.\s/.test(line)) {
      flushQuote(`f${idx}`);
      if (!list || !list.ordered) flushList(`f${idx}b`);
      list ??= { ordered: true, items: [] };
      list.items.push(
        <li key={idx}>{renderInline(line.replace(/^\d+\.\s/, ""), `l${idx}`)}</li>,
      );
    } else if (line.trim() === "") {
      flushAll(`f${idx}`);
    } else {
      flushAll(`f${idx}`);
      const isFirstP = !sawFirstP;
      sawFirstP = true;
      if (isFirstP && line.length > 1 && /^[A-Za-z"“]/.test(line)) {
        out.push(
          <p key={idx}>
            <span className="fp-dropcap">{line.charAt(0)}</span>
            {renderInline(line.slice(1), `p${idx}`)}
          </p>,
        );
      } else {
        out.push(<p key={idx}>{renderInline(line, `p${idx}`)}</p>);
      }
    }
  });
  flushAll("end");

  return <>{out}</>;
}
