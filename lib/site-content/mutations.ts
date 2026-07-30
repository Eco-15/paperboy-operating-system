// Pure, immutable mutation helpers for the Site Editor. Every canvas edit
// funnels through one of these so behavior is testable and an undo stack can
// attach later without touching the components.

import type {
  Classified,
  HomeContent,
  PortfolioCard,
  PortfolioContent,
  Story,
} from "./schema";

export type StoryRow = "columnStories" | "footStories";

export function updateStory(
  content: HomeContent,
  row: StoryRow,
  id: string,
  patch: Partial<Story>,
): HomeContent {
  return {
    ...content,
    [row]: content[row].map((s) => (s.id === id ? { ...s, ...patch } : s)),
  };
}

export function updateLead(content: HomeContent, patch: Partial<Story>): HomeContent {
  return { ...content, lead: { ...content.lead, ...patch } };
}

export function moveStory(
  content: HomeContent,
  row: StoryRow,
  from: number,
  to: number,
): HomeContent {
  if (from === to || from < 0 || to < 0) return content;
  const list = [...content[row]];
  if (from >= list.length || to >= list.length) return content;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return { ...content, [row]: list };
}

// Swap a row story into the lead slot (and the old lead into its place).
export function promoteToLead(
  content: HomeContent,
  row: StoryRow,
  id: string,
): HomeContent {
  const idx = content[row].findIndex((s) => s.id === id);
  if (idx < 0) return content;
  const list = [...content[row]];
  const promoted = list[idx];
  list[idx] = content.lead;
  return { ...content, lead: promoted, [row]: list };
}

let addCounter = 0;
function freshId(prefix: string) {
  addCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${addCounter}`;
}

export function addStory(content: HomeContent, row: StoryRow): HomeContent {
  const story: Story = {
    id: freshId("story"),
    headline: "New headline",
    deck: "A one-line deck for the new story.",
    body: ["Write the story here."],
    href: "/",
  };
  return { ...content, [row]: [...content[row], story] };
}

export function deleteStory(
  content: HomeContent,
  row: StoryRow,
  id: string,
): HomeContent {
  return { ...content, [row]: content[row].filter((s) => s.id !== id) };
}

export function duplicateStory(
  content: HomeContent,
  row: StoryRow,
  id: string,
): HomeContent {
  const idx = content[row].findIndex((s) => s.id === id);
  if (idx < 0) return content;
  const copy: Story = structuredClone(content[row][idx]);
  copy.id = freshId("story");
  const list = [...content[row]];
  list.splice(idx + 1, 0, copy);
  return { ...content, [row]: list };
}

// Move a story from one row to another (cross-container drag).
export function moveStoryAcross(
  content: HomeContent,
  fromRow: StoryRow,
  fromIndex: number,
  toRow: StoryRow,
  toIndex: number,
): HomeContent {
  if (fromRow === toRow) return moveStory(content, fromRow, fromIndex, toIndex);
  const from = [...content[fromRow]];
  if (fromIndex < 0 || fromIndex >= from.length) return content;
  const [story] = from.splice(fromIndex, 1);
  const to = [...content[toRow]];
  const at = Math.max(0, Math.min(toIndex, to.length));
  to.splice(at, 0, story);
  return { ...content, [fromRow]: from, [toRow]: to };
}

// ── classifieds ───────────────────────────────────────────────────────────────

export function updateClassified(
  content: HomeContent,
  index: number,
  patch: Partial<Classified>,
): HomeContent {
  return {
    ...content,
    classifieds: content.classifieds.map((c, i) =>
      i === index ? { ...c, ...patch } : c,
    ),
  };
}

export function addClassified(content: HomeContent): HomeContent {
  return {
    ...content,
    classifieds: [
      ...content.classifieds,
      { kicker: "Notices", line: "New classified", href: "/" },
    ],
  };
}

export function duplicateClassified(content: HomeContent, index: number): HomeContent {
  const c = content.classifieds[index];
  if (!c) return content;
  const list = [...content.classifieds];
  list.splice(index + 1, 0, { ...c });
  return { ...content, classifieds: list };
}

export function deleteClassified(content: HomeContent, index: number): HomeContent {
  return {
    ...content,
    classifieds: content.classifieds.filter((_, i) => i !== index),
  };
}

export function moveClassified(
  content: HomeContent,
  from: number,
  to: number,
): HomeContent {
  if (from === to || from < 0 || to < 0) return content;
  const list = [...content.classifieds];
  if (from >= list.length || to >= list.length) return content;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return { ...content, classifieds: list };
}

// ── paragraphs (used for stories and simple-page paragraph lists) ─────────────

export function setParagraph(body: string[], index: number, text: string): string[] {
  return body.map((p, i) => (i === index ? text : p));
}

export function addParagraph(body: string[], afterIndex?: number): string[] {
  const next = [...body];
  const at = afterIndex == null ? next.length : afterIndex + 1;
  next.splice(at, 0, "New paragraph.");
  return next;
}

export function deleteParagraph(body: string[], index: number): string[] {
  return body.filter((_, i) => i !== index);
}

// Enter mid-paragraph: replace paragraph i with the text before the caret and
// insert the text after it as a new paragraph.
export function splitParagraph(
  body: string[],
  index: number,
  before: string,
  after: string,
): string[] {
  const next = [...body];
  next.splice(index, 1, before, after);
  return next;
}

// Backspace at the start of paragraph i: join it onto the previous one.
export function mergeParagraph(body: string[], index: number): string[] {
  if (index <= 0 || index >= body.length) return body;
  const next = [...body];
  const merged = [next[index - 1], next[index]].filter(Boolean).join(" ");
  next.splice(index - 1, 2, merged);
  return next;
}

export function moveParagraph(body: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= body.length || to >= body.length) {
    return body;
  }
  const next = [...body];
  const [p] = next.splice(from, 1);
  next.splice(to, 0, p);
  return next;
}

// ── portfolio cards ───────────────────────────────────────────────────────────

export function updateCard(
  content: PortfolioContent,
  id: string,
  patch: Partial<PortfolioCard>,
): PortfolioContent {
  return {
    ...content,
    cards: content.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
}

export function moveCard(
  content: PortfolioContent,
  from: number,
  to: number,
): PortfolioContent {
  if (from === to || from < 0 || to < 0) return content;
  const cards = [...content.cards];
  if (from >= cards.length || to >= cards.length) return content;
  const [card] = cards.splice(from, 1);
  cards.splice(to, 0, card);
  return { ...content, cards };
}

export function addCard(content: PortfolioContent): PortfolioContent {
  const card: PortfolioCard = {
    id: freshId("card"),
    brand: "New Brand",
    sector: "Category",
    thesis: "Why the desk backed it.",
    tag: "Fund I",
  };
  return { ...content, cards: [...content.cards, card] };
}

export function deleteCard(content: PortfolioContent, id: string): PortfolioContent {
  return { ...content, cards: content.cards.filter((c) => c.id !== id) };
}

export function duplicateCard(content: PortfolioContent, id: string): PortfolioContent {
  const idx = content.cards.findIndex((c) => c.id === id);
  if (idx < 0) return content;
  const copy: PortfolioCard = structuredClone(content.cards[idx]);
  copy.id = freshId("card");
  const cards = [...content.cards];
  cards.splice(idx + 1, 0, copy);
  return { ...content, cards };
}
