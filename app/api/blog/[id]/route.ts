import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";
import { blogDraftSchema } from "@/lib/blog/schema";
import { draftOf, toBlogPost } from "@/lib/blog/server";

async function getRow(id: string) {
  const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
  return row ?? null;
}

// Full record for the editor.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const row = await getRow((await params).id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ post: toBlogPost(row), draft: draftOf(row) });
}

// Merge partial fields into the draft jsonb. Never touches the published
// (flat) columns — the public page is unaffected until Publish.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const row = await getRow((await params).id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = blogDraftSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const draft = { ...draftOf(row), ...parsed.data };
  const [updated] = await db
    .update(blogPosts)
    .set({ draft, updatedAt: new Date() })
    .where(eq(blogPosts.id, row.id))
    .returning();

  return NextResponse.json({ post: toBlogPost(updated), draft });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const row = await getRow((await params).id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(blogPosts).where(eq(blogPosts.id, row.id));
  return NextResponse.json({ ok: true });
}
