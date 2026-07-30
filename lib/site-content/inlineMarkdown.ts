// The Site Editor's inline formatting subset: **bold**, *italic*, and
// [label](href), stored as plain markdown inside ordinary content strings.
// One module owns BOTH directions — parseInline (string → node tree, used by
// the public InlineText renderer and the editor's contentEditable mount) and
// serializeDom (edited DOM → string). Keeping them together is the round-trip
// fidelity guarantee: serialize(render(s)) must equal s for the subset, and a
// plain string with no markers must render byte-identically.

export type InlineNode =
  | string
  | { t: "strong"; kids: InlineNode[] }
  | { t: "em"; kids: InlineNode[] }
  | { t: "a"; href: string; kids: InlineNode[] };

// [label](href) — label may contain marks; href stops at the first ')' and
// may not contain whitespace (keeps stray parens in prose from linkifying).
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/;
// Lazy bold first so **a *b* c** nests; then italic on what remains.
const BOLD_RE = /\*\*(.+?)\*\*/;
const EM_RE = /\*([^*]+)\*/;

function parseEm(s: string): InlineNode[] {
  const out: InlineNode[] = [];
  let rest = s;
  for (;;) {
    const m = EM_RE.exec(rest);
    if (!m) break;
    if (m.index > 0) out.push(rest.slice(0, m.index));
    out.push({ t: "em", kids: [m[1]] });
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) out.push(rest);
  return out;
}

function parseMarks(s: string): InlineNode[] {
  const out: InlineNode[] = [];
  let rest = s;
  for (;;) {
    const m = BOLD_RE.exec(rest);
    if (!m) break;
    if (m.index > 0) out.push(...parseEm(rest.slice(0, m.index)));
    out.push({ t: "strong", kids: parseEm(m[1]) });
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) out.push(...parseEm(rest));
  return out;
}

export function parseInline(s: string): InlineNode[] {
  const out: InlineNode[] = [];
  let rest = s;
  for (;;) {
    const m = LINK_RE.exec(rest);
    if (!m) break;
    if (m.index > 0) out.push(...parseMarks(rest.slice(0, m.index)));
    out.push({ t: "a", href: m[2], kids: parseMarks(m[1]) });
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) out.push(...parseMarks(rest));
  return out;
}

export function serializeNodes(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      if (typeof n === "string") return n;
      const inner = serializeNodes(n.kids);
      if (!inner) return "";
      if (n.t === "strong") return `**${inner}**`;
      if (n.t === "em") return `*${inner}*`;
      return `[${inner}](${n.href})`;
    })
    .join("");
}

// Plain-text projection (for caret math and placeholder checks).
export function inlineToText(nodes: InlineNode[]): string {
  return nodes
    .map((n) => (typeof n === "string" ? n : inlineToText(n.kids)))
    .join("");
}

// DOM → markdown. Walks childNodes of an edited contentEditable element:
// STRONG/B → **, EM/I → *, A → [..](href); everything else (SPAN, FONT, DIV
// the browser may sneak in) is unwrapped, never dropped, so text always
// survives even if formatting doesn't.
type DomNodeLike = {
  nodeType: number;
  nodeName: string;
  childNodes: ArrayLike<DomNodeLike>;
  data?: string;
  getAttribute?: (name: string) => string | null;
};

export function serializeDom(el: DomNodeLike): string {
  let out = "";
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child.nodeType === 3) {
      out += child.data ?? "";
      continue;
    }
    if (child.nodeType !== 1) continue;
    const tag = child.nodeName.toUpperCase();
    if (tag === "BR") {
      out += " ";
      continue;
    }
    const inner = serializeDom(child);
    if (tag === "STRONG" || tag === "B") {
      out += inner ? `**${inner}**` : "";
    } else if (tag === "EM" || tag === "I") {
      out += inner ? `*${inner}*` : "";
    } else if (tag === "A") {
      const href = child.getAttribute?.("href") ?? "#";
      out += inner ? `[${inner}](${href})` : "";
    } else {
      out += inner;
    }
  }
  return out;
}

export function serializeDomTrimmed(el: DomNodeLike): string {
  return serializeDom(el).replace(/\s+/g, " ").trim();
}
