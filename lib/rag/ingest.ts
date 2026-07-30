import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { driveFiles, docChunks } from "../db/schema";
import {
  getDriveClient,
  listDriveFiles,
  extractText,
  downloadFileBytes,
  extractPdfText,
  extractOfficeText,
  isPdf,
  isOffice,
} from "./drive";
import { listAccessors } from "./permissions";
import { chunkText } from "./chunk";
import { embedText } from "./embeddings";

// Why a file produced no chunks. Previously ALL of these collapsed into one
// `skipped` counter with no filename logged anywhere — so "Done. 40 processed,
// 60 skipped" looked identical whether those 60 were unchanged or whether every
// important PDF in the firm had blown up. That is exactly how a 204 MB investment
// memo went missing from the index without a trace.
export type SkipReason =
  | "unchanged"
  | "junk"
  | "unsupported_media"
  | "unsupported_mime"
  | "duplicate"
  | "too_large"
  | "download_failed"
  | "extract_failed"
  | "ocr_skipped_size"
  | "ocr_skipped_budget"
  | "ocr_failed"
  | "embed_failed"
  | "empty_text";

/** A file that did NOT make it into the index, and why. */
export interface IngestFailure {
  file: string;
  id: string;
  reason: SkipReason;
  detail?: string;
}

export interface IngestSummary {
  totalFiles: number;
  processed: number;
  skipped: number;
  totalChunks: number;
  /**
   * Files whose ACL came back empty. These match NO principal, so they are
   * invisible to every non-admin. A healthy ingest reports 0 — anything else means
   * retrieval is silently returning nothing for most users.
   */
  filesWithNoAccessors: number;
  /** Every skip bucketed by reason — must account for all skipped files. */
  skippedByReason: Record<SkipReason, number>;
  /**
   * Named files that were LOST (i.e. every skip except `unchanged`/`duplicate`,
   * which are benign). If this is non-empty, the index is incomplete — say so
   * loudly rather than reporting success.
   */
  failures: IngestFailure[];
}

// Anthropic's document-block limit is 32 MB; the cap was 20 MB, which needlessly
// rejected real documents (e.g. a 22 MB closing-documents PDF) as unreadable.
const MAX_PDF_BYTES = 32 * 1024 * 1024;
const MAX_PDF_OCR = Number(process.env.MAX_PDF_OCR ?? 20); // per-run OCR cap.

// OS/editor detritus. Not documents — counting them as "lost" buries the real failures
// in noise, which is how a genuinely missing memo stays invisible.
const JUNK_FILE = /^(\.DS_Store|Thumbs\.db|desktop\.ini|\.gitkeep|~\$.*)$/i;
// Hard ceiling on what we'll pull into memory. Above this we skip LOUDLY (named in
// `failures`) instead of OOM-killing the container mid-run and losing the whole sync.
const MAX_DOWNLOAD_BYTES = Number(process.env.MAX_DOWNLOAD_BYTES ?? 300 * 1024 * 1024);
// Under this many chars, a PDF's "text layer" is almost certainly junk — design
// exports (Figma/Canva/Keynote) carry stray glyphs like "1" or "Page 1". OCR used to
// fire only on a COMPLETELY empty layer, so those decks were stored as one garbage
// chunk and never transcribed. Treat a near-empty layer as no layer.
const MIN_USABLE_TEXT_CHARS = Number(process.env.MIN_USABLE_TEXT_CHARS ?? 200);

// The doc's title, used both for display AND prepended to every chunk's embedding —
// so a junk first line becomes the document's semantic identity in the index. Prefer
// the first substantive line; fall back to the filename when it looks like noise.
function deriveTitle(text: string, fallback: string): string {
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^#+\s*/, "").trim();
    if (!line) continue;
    // Page numbers, bullets, single glyphs — not a title.
    if (line.length < 4 || /^[\d\W_]+$/.test(line)) continue;
    return line.slice(0, 200);
  }
  return fallback;
}

async function embedChunks(chunks: string[]): Promise<number[][]> {
  const out: number[][] = [];
  const BATCH = 16; // keep well under Vertex's per-request token cap
  for (let i = 0; i < chunks.length; i += BATCH) {
    const vecs = await embedText(chunks.slice(i, i + BATCH), "RETRIEVAL_DOCUMENT");
    out.push(...vecs);
  }
  return out;
}

// Transcribe a scanned/image PDF (no usable text layer) with Claude Haiku vision.
//
// max_tokens was 8000, which SILENTLY TRUNCATED long decks mid-document — the tail was
// simply lost and the partial text stored as if complete. Raising it means the request
// can exceed the SDK's 10-minute non-streaming ceiling ("Streaming is required for
// operations that may take longer than 10 minutes"), so this MUST stream.
async function ocrPdf(bytes: Buffer): Promise<string> {
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 32000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: bytes.toString("base64"),
            },
          },
          {
            type: "text",
            text: "Transcribe all readable text from this document as plain text. Preserve headings and structure. Output only the transcription.",
          },
        ],
      },
    ],
  });
  const msg = await stream.finalMessage();
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// Sync the Shared Drive into pgvector. Re-embeds only new/changed files (by
// modifiedTime). Captures per-file accessors (drive membership ∪ explicit
// shares) so retrieval can filter per user.
export async function ingestSharedDrive(): Promise<IngestSummary> {
  const driveId = process.env.SHARED_DRIVE_ID;
  if (!driveId) throw new Error("SHARED_DRIVE_ID is not set");

  const drive = getDriveClient();
  const files = await listDriveFiles(drive, driveId);

  // Drive returns an empty list — not an error — when the service account simply
  // can't see the root. That used to be reported as "Synced 0 of 0 files" and read
  // as success, so a Drive that was never shared with the service account looked
  // exactly like a Drive with nothing in it. Fail instead.
  if (files.length === 0) {
    throw new Error(
      `SHARED_DRIVE_ID=${driveId} resolved to 0 files. Either the folder is empty, or (far more ` +
        `likely) the runtime service account has not been given access to it. Share the Drive ` +
        `folder with the service account and re-run.`,
    );
  }

  // Baseline: who can open the Shared Drive itself (most files inherit this).
  const driveAccessors = await listAccessors(drive, driveId);

  let processed = 0;
  let skipped = 0;
  let totalChunks = 0;
  let ocrCount = 0;
  let filesWithNoAccessors = 0;

  const skippedByReason = {} as Record<SkipReason, number>;
  const failures: IngestFailure[] = [];

  // Record every file that does NOT get indexed, with its name and the real reason.
  // `unchanged`/`duplicate` are benign; everything else means a document was LOST and
  // must show up in `failures` so the run can't quietly claim success.
  // Benign: the file was never meant to be indexed, or already is. Everything else is
  // a DOCUMENT WE LOST and must be named.
  const BENIGN: SkipReason[] = ["unchanged", "duplicate", "junk", "unsupported_media"];

  const skip = (f: { id: string; name: string }, reason: SkipReason, detail?: string) => {
    skipped++;
    skippedByReason[reason] = (skippedByReason[reason] ?? 0) + 1;
    if (!BENIGN.includes(reason)) {
      failures.push({ file: f.name, id: f.id, reason, detail });
      console.warn(`[ingest] DROPPED "${f.name}" (${f.id}) — ${reason}${detail ? `: ${detail}` : ""}`);
    }
  };

  // Drive is full of duplicate uploads (the FON Series A memo exists 5× at 204 MB
  // each — ~1 GB of pointless downloads and 5× the embedding cost per sync). Index
  // one copy per identical content.
  const seenContent = new Map<string, string>(); // md5|size:name -> first file name

  for (const f of files) {
    // OS junk — not a document, and not a failure. Counted quietly.
    if (JUNK_FILE.test(f.name)) {
      skipped++;
      skippedByReason.junk = (skippedByReason.junk ?? 0) + 1;
      continue;
    }

    const dupeKey = f.md5Checksum ?? (f.size ? `${f.size}:${f.name}` : null);
    if (dupeKey) {
      const firstSeen = seenContent.get(dupeKey);
      if (firstSeen) {
        skip(f, "duplicate", `identical to "${firstSeen}"`);
        continue;
      }
      seenContent.set(dupeKey, f.name);
    }

    const [existing] = await db
      .select()
      .from(driveFiles)
      .where(eq(driveFiles.driveFileId, f.id))
      .limit(1);

    // Who may open this file = drive membership ∪ explicit file permissions.
    // Computed BEFORE the unchanged-check on purpose: sharing a file doesn't change
    // its modifiedTime, so a file whose ACL was never captured (or has since changed)
    // would otherwise be skipped forever and keep an empty `accessors` — which
    // matches no principal, making it invisible to every non-admin. Re-embedding is
    // the expensive part; re-reading permissions is one cheap call.
    const fileAccessors = await listAccessors(drive, f.id);
    const accessors = Array.from(new Set([...driveAccessors, ...fileAccessors]));
    if (!accessors.length) filesWithNoAccessors++;

    // Skip unchanged files — but refresh their ACL first.
    if (
      existing?.modifiedTime &&
      f.modifiedTime &&
      new Date(f.modifiedTime) <= existing.modifiedTime
    ) {
      await db
        .update(driveFiles)
        .set({ accessors })
        .where(eq(driveFiles.driveFileId, f.id));
      skip(f, "unchanged");
      continue;
    }

    // ── Extract text ────────────────────────────────────────────────────────────
    // Order matters: check isPdf FIRST. Drive routinely labels uploaded PDFs
    // `application/octet-stream`, which `isDownloadableText` accepts — so the old
    // order fetched them with responseType:"text" and stored BINARY PDF BYTES as
    // chunk text. Because that garbage is non-empty, it never entered the PDF branch
    // and was embedded as if it were a real document.
    let text: string | null = null;

    if (isPdf(f)) {
      const size = Number(f.size ?? 0);
      if (size > MAX_DOWNLOAD_BYTES) {
        // Loud, named skip — never an OOM that kills the whole run.
        skip(f, "too_large", `${(size / 1048576).toFixed(0)} MB > ${(MAX_DOWNLOAD_BYTES / 1048576).toFixed(0)} MB cap`);
        continue;
      }

      let bytes: Buffer;
      try {
        bytes = await downloadFileBytes(drive, f.id);
      } catch (e) {
        skip(f, "download_failed", (e as Error).message);
        continue;
      }

      try {
        text = await extractPdfText(bytes);
      } catch (e) {
        skip(f, "extract_failed", (e as Error).message);
        continue;
      }

      // Decide whether the text layer is real or junk. A design-exported deck carries
      // stray glyphs ("1", "Page 3"), which used to defeat the empty-check and get
      // stored as one meaningless chunk. (For reference, the real 25-page FON memo
      // yields ~24,900 chars — genuine text layers are not subtle.)
      const looksJunk = !text || text.trim().length < MIN_USABLE_TEXT_CHARS;

      if (looksJunk) {
        if (bytes.length > MAX_PDF_BYTES) {
          skip(f, "ocr_skipped_size", `no usable text layer; ${(bytes.length / 1048576).toFixed(0)} MB exceeds the ${MAX_PDF_BYTES / 1048576} MB OCR limit`);
          continue;
        }
        if (ocrCount >= MAX_PDF_OCR) {
          skip(f, "ocr_skipped_budget", `no usable text layer; per-run OCR budget (${MAX_PDF_OCR}) exhausted`);
          continue;
        }
        try {
          text = await ocrPdf(bytes);
          ocrCount++; // only AFTER success — a failed call used to burn the budget
        } catch (e) {
          skip(f, "ocr_failed", (e as Error).message);
          continue;
        }
      }
    } else if (isOffice(f)) {
      const size = Number(f.size ?? 0);
      if (size > MAX_DOWNLOAD_BYTES) {
        skip(f, "too_large", `${(size / 1048576).toFixed(0)} MB > ${(MAX_DOWNLOAD_BYTES / 1048576).toFixed(0)} MB cap`);
        continue;
      }
      let bytes: Buffer;
      try {
        bytes = await downloadFileBytes(drive, f.id);
      } catch (e) {
        skip(f, "download_failed", (e as Error).message);
        continue;
      }
      try {
        text = await extractOfficeText(bytes, f);
      } catch (e) {
        skip(f, "extract_failed", (e as Error).message);
        continue;
      }
    } else {
      try {
        text = await extractText(drive, f);
      } catch (e) {
        // A Drive 403/429/export error — a real failure, not an unsupported type.
        skip(f, "download_failed", (e as Error).message);
        continue;
      }
      if (text === null) {
        // Images/video/audio are not documents. Bucket them separately so they don't
        // bury the real failures — the Drive holds ~230 of them, mostly scans.
        //
        // Deliberately NOT OCR'd: this Drive contains DRIVER_LICENSE_*.jpg and
        // PASSPORT_US_*.jpeg (investor onboarding KYC). Transcribing those would pull
        // identity-document PII into a vector index that every staff member can query.
        // Leaving them unindexed is the correct behaviour, not a gap to close.
        const mt = f.mimeType ?? "unknown";
        if (/^(image|video|audio)\//.test(mt)) {
          skip(f, "unsupported_media", mt);
          continue;
        }
        skip(f, "unsupported_mime", mt);
        continue;
      }
    }

    if (!text || !text.trim()) {
      skip(f, "empty_text");
      continue;
    }

    const title = deriveTitle(text, f.name);
    const chunks = chunkText(text);
    if (!chunks.length) {
      skip(f, "empty_text", "text extracted but produced no chunks");
      continue;
    }

    // Embed the title alongside each chunk so every chunk carries its doc topic.
    // Isolated per file: an embedding failure used to throw straight out of the loop
    // and kill the ENTIRE run, so every file after it was silently never indexed.
    // One bad file must cost one bad file.
    let embeddings: number[][];
    try {
      embeddings = await embedChunks(chunks.map((c) => `${title}\n\n${c}`));
    } catch (e) {
      skip(f, "embed_failed", (e as Error).message);
      continue;
    }

    await db
      .insert(driveFiles)
      .values({
        driveFileId: f.id,
        name: f.name,
        title,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime ? new Date(f.modifiedTime) : null,
        webLink: f.webViewLink,
        accessors,
        source: "drive_raw",
        lastSyncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: driveFiles.driveFileId,
        set: {
          name: f.name,
          title,
          mimeType: f.mimeType,
          modifiedTime: f.modifiedTime ? new Date(f.modifiedTime) : null,
          webLink: f.webViewLink,
          accessors,
          source: "drive_raw",
          lastSyncedAt: new Date(),
        },
      });

    await db.delete(docChunks).where(eq(docChunks.driveFileId, f.id));
    await db.insert(docChunks).values(
      chunks.map((content, i) => ({
        driveFileId: f.id,
        chunkIndex: i,
        content, // raw chunk for display; embedding above is title-prefixed
        embedding: embeddings[i],
      })),
    );

    processed++;
    totalChunks += chunks.length;
  }

  if (filesWithNoAccessors > 0) {
    console.warn(
      `[ingest] ${filesWithNoAccessors}/${files.length} files have NO accessors — they will be ` +
        `invisible to every non-admin user. Check that the runtime service account can read ` +
        `permissions on the Drive folder.`,
    );
  }

  // A run that lost documents must never just print "Done." Name what it dropped.
  if (failures.length > 0) {
    const byReason = Object.entries(skippedByReason)
      .filter(([r]) => r !== "unchanged" && r !== "duplicate")
      .map(([r, n]) => `${r}=${n}`)
      .join(" ");
    console.warn(
      `[ingest] ${failures.length} FILE(S) DID NOT MAKE IT INTO THE INDEX (${byReason}). ` +
        `These documents are not searchable:`,
    );
    for (const f of failures) console.warn(`  ✗ ${f.file} — ${f.reason}${f.detail ? ` (${f.detail})` : ""}`);
  }

  return {
    totalFiles: files.length,
    processed,
    skipped,
    totalChunks,
    filesWithNoAccessors,
    skippedByReason,
    failures,
  };
}
