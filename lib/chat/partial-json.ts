// ── Reading a string out of JSON that hasn't finished arriving ───────────────
//
// When Claude calls a tool, it streams the tool's input as `input_json_delta`
// fragments — raw, partial JSON. Because an artifact's body lives INSIDE that tool
// input, the document is already being streamed to us character by character; we
// just couldn't read it, because partial JSON doesn't parse.
//
// So: scan for the key and walk its string value, honouring escapes, tolerating a
// buffer that stops anywhere — mid-word, mid-escape, mid-\uXXXX. That's what turns
// "silence, then the document appears fully formed" into a document that writes
// itself in the panel.

const ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
  '"': '"',
  "\\": "\\",
  "/": "/",
};

/**
 * Extract the (possibly still-growing) value of a top-level string key from a
 * partial JSON buffer. Returns null if the key's value hasn't started arriving.
 *
 * Safe to call on every delta: it's a forward scan, and callers pass the whole
 * accumulated buffer.
 */
export function extractStreamingString(buffer: string, key: string): string | null {
  const opener = new RegExp(`"${key}"\\s*:\\s*"`);
  const m = opener.exec(buffer);
  if (!m) return null;

  let i = m.index + m[0].length;
  let out = "";

  while (i < buffer.length) {
    const ch = buffer[i];

    if (ch === '"') return out; // closing quote — the value is complete

    if (ch !== "\\") {
      out += ch;
      i++;
      continue;
    }

    // An escape sequence. If the buffer ends inside it, emit nothing for it — the
    // rest arrives next delta. Emitting the bare "\" would flash a stray backslash,
    // and worse, a half-written \" would be mistaken for the closing quote.
    const next = buffer[i + 1];
    if (next === undefined) return out;

    if (next === "u") {
      const hex = buffer.slice(i + 2, i + 6);
      if (hex.length < 4) return out; // \u12… still arriving
      const code = parseInt(hex, 16);
      if (Number.isNaN(code)) return out; // malformed — stop rather than corrupt
      out += String.fromCharCode(code);
      i += 6;
      continue;
    }

    const mapped = ESCAPES[next];
    if (mapped === undefined) {
      // Unknown escape — pass the character through rather than dropping content.
      out += next;
      i += 2;
      continue;
    }
    out += mapped;
    i += 2;
  }

  return out; // buffer ran out mid-value; this is the text so far
}

/** True once the key's string value has been fully received (closing quote seen). */
export function isStringComplete(buffer: string, key: string): boolean {
  const opener = new RegExp(`"${key}"\\s*:\\s*"`);
  const m = opener.exec(buffer);
  if (!m) return false;

  let i = m.index + m[0].length;
  while (i < buffer.length) {
    const ch = buffer[i];
    if (ch === '"') return true;
    i += ch === "\\" ? 2 : 1;
  }
  return false;
}
