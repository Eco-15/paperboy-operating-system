// Renders a content string with the Site Editor's inline-markdown subset
// (**bold**, *italic*, [label](href)). Server-safe, zero deps. Plain strings
// render byte-identically (no wrapper element — a fragment of text nodes).
// `dropcap` peels the first character into the newspaper drop cap, replacing
// the old charAt(0)/slice(1) hack (which broke on marker-leading paragraphs).

import { parseInline, type InlineNode } from "@/lib/site-content/inlineMarkdown";

function renderNodes(nodes: InlineNode[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}${i}`;
    if (typeof n === "string") return n;
    if (n.t === "strong") {
      return <strong key={key}>{renderNodes(n.kids, `${key}.`)}</strong>;
    }
    if (n.t === "em") {
      return <em key={key}>{renderNodes(n.kids, `${key}.`)}</em>;
    }
    const external = /^https?:\/\//.test(n.href);
    return (
      <a
        key={key}
        href={n.href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {renderNodes(n.kids, `${key}.`)}
      </a>
    );
  });
}

export default function InlineText({
  value,
  dropcap,
}: {
  value: string;
  dropcap?: boolean;
}) {
  const nodes = parseInline(value);
  if (!dropcap) return <>{renderNodes(nodes, "n")}</>;

  // Peel the first character of the first text node for the drop cap.
  const first = nodes[0];
  if (typeof first === "string" && first.length > 0) {
    const rest = [first.slice(1), ...nodes.slice(1)].filter(
      (n) => n !== "",
    ) as InlineNode[];
    return (
      <>
        <span className="fp-dropcap">{first.charAt(0)}</span>
        {renderNodes(rest, "n")}
      </>
    );
  }
  return <>{renderNodes(nodes, "n")}</>;
}
