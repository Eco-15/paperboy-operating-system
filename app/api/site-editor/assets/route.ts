import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { siteAssets } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";

// Keep uploads well under Cloud Run's 32 MB request cap (the editor also
// downscales images client-side before uploading).
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Asset library for the Site Editor — metadata only, never the bytes.
export async function GET() {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await db
    .select({
      id: siteAssets.id,
      filename: siteAssets.filename,
      mime: siteAssets.mime,
      size: siteAssets.size,
      alt: siteAssets.alt,
      createdAt: siteAssets.createdAt,
    })
    .from(siteAssets)
    .orderBy(desc(siteAssets.createdAt))
    .limit(200);
  return NextResponse.json({
    assets: rows.map((r) => ({ ...r, url: `/api/site/assets/${r.id}` })),
  });
}

// Upload an image (multipart `file`, optional `alt`). Returns the public URL
// the content should reference. Assets are immutable — replacing an image is
// a new upload/id, which is what makes the long-lived cache header safe.
export async function POST(req: Request) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form" }, { status: 400 });

  const file = form.get("file");
  const alt = String(form.get("alt") ?? "").trim() || null;
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Attach an image file." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only images can be uploaded." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Image is too large (25 MB max)." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const [row] = await db
    .insert(siteAssets)
    .values({
      filename: file.name || null,
      mime: file.type,
      size: file.size,
      bytes,
      alt,
      uploadedBy: user.id,
    })
    .returning({ id: siteAssets.id });

  return NextResponse.json(
    { id: row.id, url: `/api/site/assets/${row.id}` },
    { status: 201 },
  );
}
