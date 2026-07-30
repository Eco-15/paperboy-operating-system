import { google, type drive_v3 } from "googleapis";

// Drive client authenticated as the paperboy-app service account (read-only).
// On Cloud Run this is ADC; locally it's `gcloud auth application-default login`.
export function getDriveClient(): drive_v3.Drive {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  webViewLink: string | null;
  /** Bytes. Used to guard the download and to detect duplicates. */
  size: number | null;
  /** Drive's content hash — the reliable duplicate key (binary files only). */
  md5Checksum: string | null;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";

// Resolve a Drive shortcut to the file it points at. Shortcuts have no content —
// downloading one returns 403 — so they used to fail as `download_failed` and their
// real documents (e.g. "Joon Foods Investor Memo", "Paperboy_DiligenceMaterials")
// were never indexed at all. Follow the pointer instead.
async function resolveShortcut(
  drive: drive_v3.Drive,
  targetId: string,
  shortcutName: string,
): Promise<DriveFile | null> {
  try {
    const { data } = await drive.files.get({
      fileId: targetId,
      supportsAllDrives: true,
      fields: "id, name, mimeType, modifiedTime, webViewLink, size, md5Checksum, trashed",
    });
    if (!data.id || !data.name || !data.mimeType) return null;
    if (data.trashed) {
      console.warn(`[drive] shortcut "${shortcutName}" points at a TRASHED file — not indexed.`);
      return null;
    }
    if (data.mimeType === FOLDER_MIME || data.mimeType === SHORTCUT_MIME) return null;
    return {
      id: data.id,
      name: data.name,
      mimeType: data.mimeType,
      modifiedTime: data.modifiedTime ?? null,
      webViewLink: data.webViewLink ?? null,
      size: data.size != null ? Number(data.size) : null,
      md5Checksum: data.md5Checksum ?? null,
    };
  } catch (e) {
    // A DANGLING shortcut: the file it pointed at was deleted, or was never shared
    // with the service account. The document is genuinely gone — say so, loudly, or it
    // silently ceases to exist exactly like the memo did.
    console.warn(
      `[drive] BROKEN SHORTCUT "${shortcutName}" → target ${targetId} is unreachable ` +
        `(${(e as Error).message}). Nothing to index — fix the shortcut in Drive.`,
    );
    return null;
  }
}

// Recursively list all non-trashed files under a root (works whether `rootId`
// is a whole Shared Drive's ID or a single folder ID, in My Drive or a Shared
// Drive). Walks subfolders via parent queries across all drives.
export async function listDriveFiles(
  drive: drive_v3.Drive,
  rootId: string,
): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  const queue = [rootId];
  const seen = new Set<string>();

  while (queue.length) {
    const folderId = queue.shift()!;
    if (seen.has(folderId)) continue;
    seen.add(folderId);

    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        corpora: "allDrives",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageSize: 1000,
        fields:
          "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink, size, md5Checksum, shortcutDetails)",
        pageToken,
      });
      for (const f of res.data.files ?? []) {
        if (!f.id || !f.name || !f.mimeType) continue;

        if (f.mimeType === FOLDER_MIME) {
          queue.push(f.id);
          continue;
        }

        // A shortcut is a pointer, not a document. Follow it — including shortcuts to
        // folders, which are whole subtrees that were previously invisible.
        if (f.mimeType === SHORTCUT_MIME) {
          const targetId = f.shortcutDetails?.targetId;
          if (!targetId) continue;
          if (f.shortcutDetails?.targetMimeType === FOLDER_MIME) {
            queue.push(targetId);
            continue;
          }
          const target = await resolveShortcut(drive, targetId, f.name);
          if (target) files.push(target);
          continue;
        }

        files.push({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          modifiedTime: f.modifiedTime ?? null,
          webViewLink: f.webViewLink ?? null,
          size: f.size != null ? Number(f.size) : null,
          md5Checksum: f.md5Checksum ?? null,
        });
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  }
  return files;
}

const EXPORT_AS: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

// Plain-text-ish files we download directly. Markdown/text files are matched by
// extension too, because Drive labels .md inconsistently (text/markdown,
// text/x-markdown, text/plain, or even application/octet-stream).
const TEXT_EXT = /\.(md|markdown|txt|text|csv|tsv|json|log|yaml|yml)$/i;

// `application/octet-stream` is deliberately NOT here. Drive routinely labels binary
// uploads (PDFs, .docx, .xlsx) as octet-stream; accepting it meant those files were
// fetched with responseType:"text" and their BINARY BYTES were stored as chunk text —
// non-empty garbage that then got embedded as if it were a real document. Binary types
// are now routed by extension/sniffing below, and anything unrecognised is skipped
// loudly rather than corrupting the index.
function isDownloadableText(file: DriveFile): boolean {
  return (
    file.mimeType.startsWith("text/") ||
    file.mimeType === "application/json" ||
    TEXT_EXT.test(file.name)
  );
}

export const PDF_MIME = "application/pdf";
export function isPdf(file: DriveFile): boolean {
  return file.mimeType === PDF_MIME || /\.pdf$/i.test(file.name);
}

// ── Native Office formats ────────────────────────────────────────────────────
// These were skipped ENTIRELY (no dependency existed), so investor decks and models
// contributed nothing to the index — a large silent hole, the same class of bug as
// the missing memo.
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";

export function isOffice(file: DriveFile): boolean {
  return (
    [DOCX_MIME, PPTX_MIME, XLSX_MIME, XLS_MIME].includes(file.mimeType) ||
    /\.(docx|pptx|xlsx|xls)$/i.test(file.name)
  );
}

function officeKind(file: DriveFile): "docx" | "pptx" | "xlsx" | null {
  if (file.mimeType === DOCX_MIME || /\.docx$/i.test(file.name)) return "docx";
  if (file.mimeType === PPTX_MIME || /\.pptx$/i.test(file.name)) return "pptx";
  if (file.mimeType === XLSX_MIME || file.mimeType === XLS_MIME || /\.xlsx?$/i.test(file.name))
    return "xlsx";
  return null;
}

/** Extract text from .docx / .pptx / .xlsx bytes. Throws on a corrupt file. */
export async function extractOfficeText(bytes: Buffer, file: DriveFile): Promise<string> {
  const kind = officeKind(file);

  if (kind === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: bytes });
    return (value ?? "").trim();
  }

  if (kind === "xlsx") {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(bytes, { type: "buffer" });
    // One CSV block per sheet, named — sheet names carry meaning in a model.
    return wb.SheetNames.map((n) => {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[n]);
      return csv.trim() ? `## ${n}\n${csv}` : "";
    })
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }

  if (kind === "pptx") {
    // A .pptx is a zip of slideN.xml; pull the <a:t> text runs out of each, in order.
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(bytes);
    const slides = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => {
        const n = (s: string) => Number(s.match(/slide(\d+)\.xml/)![1]);
        return n(a) - n(b);
      });
    const out: string[] = [];
    for (const path of slides) {
      const xml = await zip.files[path].async("string");
      const runs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
      const text = runs.join(" ").replace(/\s+/g, " ").trim();
      if (text) out.push(`## Slide ${path.match(/slide(\d+)/)![1]}\n${text}`);
    }
    return out.join("\n\n").trim();
  }

  return "";
}

// Extract plain text from a file. Returns null ONLY when the type genuinely isn't
// handled here (the caller then reports `unsupported_mime`). A Drive/export FAILURE
// now THROWS instead of returning null — previously a 403 or a rate-limit was
// indistinguishable from "unsupported type", so real errors were counted as skips
// and the run still reported success.
//
// PDFs and Office files return null from this path — ingest.ts routes those to
// extractPdfText / extractOfficeText, which need the raw bytes.
export async function extractText(
  drive: drive_v3.Drive,
  file: DriveFile,
): Promise<string | null> {
  if (isPdf(file) || isOffice(file)) return null;

  const exportMime = EXPORT_AS[file.mimeType];
  if (exportMime) {
    const res = await drive.files.export(
      { fileId: file.id, mimeType: exportMime },
      { responseType: "text" },
    );
    return typeof res.data === "string" ? res.data : String(res.data);
  }

  if (isDownloadableText(file)) {
    const res = await drive.files.get(
      { fileId: file.id, alt: "media", supportsAllDrives: true },
      { responseType: "text" },
    );
    return typeof res.data === "string" ? res.data : String(res.data);
  }

  return null; // genuinely unsupported (image, video, .zip, .fig, …)
}

// Download a file's raw bytes (e.g. a PDF) from Drive.
export async function downloadFileBytes(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<Buffer> {
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

// Extract text from a PDF's bytes. Returns "" for scanned/image PDFs with no
// text layer (the caller then falls back to Claude transcription). Loaded
// lazily — Node runtime only, invoked during ingest, never in the browser.
export async function extractPdfText(bytes: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(bytes) });
    try {
      const result = await parser.getText();
      return (result.text ?? "").trim();
    } finally {
      await parser.destroy();
    }
  } catch {
    return "";
  }
}
