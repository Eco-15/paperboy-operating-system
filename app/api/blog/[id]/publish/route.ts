import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";
import { blogDraftSchema, LEGACY_SLUGS } from "@/lib/blog/schema";
import { draftOf, toBlogPost } from "@/lib/blog/server";

async function getRow(id: string) {
  const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
  return row ?? null;
}

// Publish: validate the draft and copy it into the flat (public) columns.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const row = await getRow((await params).id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = blogDraftSchema.safeParse(draftOf(row));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: `Can't publish yet — ${first.path.join(".")}: ${first.message}` },
      { status: 400 },
    );
  }
  const d = parsed.data;
  if (!d.body.trim()) {
    return NextResponse.json(
      { error: "Can't publish yet — the post body is empty" },
      { status: 400 },
    );
  }
  if (LEGACY_SLUGS.has(d.slug)) {
    return NextResponse.json(
      { error: `The URL "/press/${d.slug}" belongs to an imported post — pick another slug` },
      { status: 409 },
    );
  }
  const [clash] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, d.slug), ne(blogPosts.id, row.id)));
  if (clash) {
    return NextResponse.json(
      { error: `Another post already uses the URL "/press/${d.slug}"` },
      { status: 409 },
    );
  }

  const [updated] = await db
    .update(blogPosts)
    .set({
      title: d.title,
      category: d.category,
      slug: d.slug,
      excerpt: d.excerpt,
      displayDate: d.displayDate || null,
      imageUrl: d.imageUrl,
      body: d.body,
      status: "published",
      draft: d,
      publishedAt: row.publishedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, row.id))
    .returning();

  return NextResponse.json({ post: toBlogPost(updated) });
}

// Unpublish: pull the post off the public site. The flat columns stay as the
// last-published snapshot; only status gates public visibility.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const row = await getRow((await params).id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [updated] = await db
    .update(blogPosts)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(blogPosts.id, row.id))
    .returning();

  return NextResponse.json({ post: toBlogPost(updated) });
}
