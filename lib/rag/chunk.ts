// Split text into overlapping chunks for embedding. Tries to break on paragraph
// or sentence boundaries near the target size so chunks stay coherent.
export function chunkText(text: string, target = 1200, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  if (clean.length <= target) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + target, clean.length);
    if (end < clean.length) {
      // Prefer a paragraph break, then a sentence/newline, within the window.
      const window = clean.slice(start, end);
      const para = window.lastIndexOf("\n\n");
      const nl = window.lastIndexOf("\n");
      const dot = window.lastIndexOf(". ");
      const cut = Math.max(para, nl, dot);
      if (cut > target * 0.5) end = start + cut + 1;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}
