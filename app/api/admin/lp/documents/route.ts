import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { portalDocuments } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";

// Keep uploads well under Cloud Run's 32 MB request cap.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const CATEGORIES = new Set(["report", "financials", "legal", "deck", "other"]);

// List data-room documents with audience info, never the bytes (staff only).
export async function GET() {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await db
    .select({
      id: portalDocuments.id,
      title: portalDocuments.title,
      category: portalDocuments.category,
      filename: portalDocuments.filename,
      mime: portalDocuments.mime,
      size: portalDocuments.size,
      externalUrl: portalDocuments.externalUrl,
      sharedWithAll: portalDocuments.sharedWithAll,
      sharedWith: portalDocuments.sharedWith,
      createdAt: portalDocuments.createdAt,
    })
    .from(portalDocuments)
    .orderBy(desc(portalDocuments.createdAt));
  return NextResponse.json({ documents: rows });
}

// Upload a document (multipart form) or register an external link (staff only).
// Fields: title, category, sharedWithAll ("true"/"false"), sharedWith (JSON
// array of lp_profile ids), and either `file` or `externalUrl`.
export async function POST(req: Request) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form" }, { status: 400 });

  const title = String(form.get("title") ?? "").trim();
  const category = String(form.get("category") ?? "report");
  const externalUrl = String(form.get("externalUrl") ?? "").trim();
  const sharedWithAll = String(form.get("sharedWithAll")) === "true";
  const file = form.get("file");

  let sharedWith: string[] = [];
  try {
    const raw = JSON.parse(String(form.get("sharedWith") ?? "[]"));
    if (Array.isArray(raw)) sharedWith = raw.filter((x) => typeof x === "string");
  } catch {
    /* keep [] */
  }

  if (!title || !CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile && !externalUrl) {
    return NextResponse.json(
      { error: "Attach a file or provide a link." },
      { status: 400 },
    );
  }
  if (hasFile && file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File is too large (25 MB max)." }, { status: 413 });
  }

  const bytes = hasFile ? Buffer.from(await file.arrayBuffer()) : null;
  const [row] = await db
    .insert(portalDocuments)
    .values({
      title,
      category,
      filename: hasFile ? file.name : null,
      mime: hasFile ? file.type || "application/octet-stream" : null,
      size: hasFile ? file.size : null,
      bytes,
      externalUrl: hasFile ? null : externalUrl,
      sharedWithAll,
      sharedWith,
      uploadedBy: user.id,
    })
    .returning({ id: portalDocuments.id });

  return NextResponse.json({ id: row.id }, { status: 201 });
}
