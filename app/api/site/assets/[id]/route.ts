import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { siteAssets } from "@/lib/db/schema";

// PUBLIC: serves editor-uploaded images referenced by published site content.
// Assets are immutable (a replacement is a new id), so the aggressive cache
// header is safe and makes the bytea-through-Node cost a first-load-only one.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [row] = await db
    .select({ bytes: siteAssets.bytes, mime: siteAssets.mime })
    .from(siteAssets)
    .where(eq(siteAssets.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
