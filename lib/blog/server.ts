import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import type { BlogDraft } from "@/lib/db/schema";
import type { BlogPost } from "./types";
import { LEGACY_SLUGS, slugify } from "./schema";

type BlogRow = typeof blogPosts.$inferSelect;

export function toBlogPost(r: BlogRow): BlogPost {
  const d = r.draft;
  const hasUnpublishedChanges =
    r.status === "published" && d != null
      ? d.title !== r.title ||
        d.category !== r.category ||
        d.slug !== (r.slug ?? "") ||
        d.excerpt !== r.excerpt ||
        d.displayDate !== (r.displayDate ?? "") ||
        d.imageUrl !== (r.imageUrl ?? "") ||
        d.body !== r.body
      : false;
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    date: r.displayDate ?? "",
    image: r.imageUrl ?? "",
    body: r.body,
    slug: r.slug,
    excerpt: r.excerpt,
    status: r.status === "published" ? "published" : "draft",
    source: "db",
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    hasUnpublishedChanges,
  };
}

// The editable payload for a row: its draft jsonb, or (for legacy rows created
// before the draft column existed) one derived from the flat columns.
export function draftOf(r: BlogRow): BlogDraft {
  return (
    r.draft ?? {
      title: r.title,
      category: r.category,
      slug: r.slug ?? slugify(r.title),
      excerpt: r.excerpt,
      displayDate: r.displayDate ?? "",
      imageUrl: r.imageUrl ?? "",
      body: r.body,
    }
  );
}

// A slug not taken by a legacy press post, a published row, or another row's
// draft. The table is small, so one fetch + in-memory dedupe is fine.
export async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title) || "post";
  const rows = await db
    .select({ id: blogPosts.id, slug: blogPosts.slug, draft: blogPosts.draft })
    .from(blogPosts);
  const taken = new Set<string>(LEGACY_SLUGS);
  for (const r of rows) {
    if (r.id === excludeId) continue;
    if (r.slug) taken.add(r.slug);
    if (r.draft?.slug) taken.add(r.draft.slug);
  }
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
