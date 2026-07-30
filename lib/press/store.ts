// Server-side read path for the public blog (/press). Merges the hand-imported
// legacy Squarespace posts (static, block-AST) with published DB posts written
// in the OS editor. FAIL-OPEN on the DB side: if Postgres is unreachable the
// public site still renders the legacy posts — never a 500.

import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import { PRESS_POSTS, type PressBlock, type PressPost } from "@/lib/marketing/pressPosts";
import { LEGACY_SLUGS } from "@/lib/blog/schema";
import { draftOf } from "@/lib/blog/server";

export type PublicPressPost = {
  kind: "legacy" | "db";
  slug: string;
  title: string;
  tag: string | null;
  dateIso: string; // yyyy-mm-dd, for display formatting + sorting
  author: string;
  excerpt: string;
  heroImage: string;
  blocks?: PressBlock[]; // legacy
  bodyMd?: string; // db
  youtube?: string;
  spotify?: string;
  sourceUrl?: string;
};

function fromLegacy(p: PressPost): PublicPressPost {
  return {
    kind: "legacy",
    slug: p.slug,
    title: p.title,
    tag: p.tag ?? null,
    dateIso: p.date,
    author: p.author,
    excerpt: p.excerpt,
    heroImage: p.heroImage,
    blocks: p.blocks,
    youtube: p.youtube,
    spotify: p.spotify,
    sourceUrl: p.sourceUrl,
  };
}

type BlogRow = typeof blogPosts.$inferSelect;

function fromRow(r: BlogRow, overlayDraft = false): PublicPressPost | null {
  const src = overlayDraft
    ? draftOf(r)
    : {
        title: r.title,
        category: r.category,
        slug: r.slug ?? "",
        excerpt: r.excerpt,
        displayDate: r.displayDate ?? "",
        imageUrl: r.imageUrl ?? "",
        body: r.body,
      };
  if (!src.slug || LEGACY_SLUGS.has(src.slug)) return null;
  const when = r.publishedAt ?? r.createdAt;
  return {
    kind: "db",
    slug: src.slug,
    title: src.title,
    tag: src.category || null,
    dateIso: when ? when.toISOString().slice(0, 10) : "",
    author: "Paperboy Ventures",
    excerpt: src.excerpt,
    heroImage: src.imageUrl,
    bodyMd: src.body,
  };
}

// Everything the /press list should show, newest first.
export async function listPressPosts(): Promise<PublicPressPost[]> {
  const posts = PRESS_POSTS.map(fromLegacy);
  try {
    const rows = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.status, "published"));
    for (const r of rows) {
      const p = fromRow(r);
      if (p) posts.push(p);
    }
  } catch (err) {
    console.warn("[press] DB read failed, showing legacy posts only:", err);
  }
  return posts.sort((a, b) => b.dateIso.localeCompare(a.dateIso));
}

// One article. Legacy posts win their slugs. With ?draft=1 and a staff
// session, unpublished posts resolve and the current draft is shown — the
// editor's live "Preview on site" link.
export async function getPressPost(
  slug: string,
  searchParams: Promise<{ draft?: string }>,
): Promise<PublicPressPost | null> {
  const legacy = PRESS_POSTS.find((p) => p.slug === slug);
  if (legacy) return fromLegacy(legacy);

  const { draft } = await searchParams;
  let preview = false;
  if (draft === "1") {
    const session = await auth();
    preview = isStaff(session?.user?.role);
  }

  try {
    if (preview) {
      // Drafts haven't been assigned their flat slug yet — match the draft's.
      const [row] = await db
        .select()
        .from(blogPosts)
        .where(
          sql`${blogPosts.slug} = ${slug} or ${blogPosts.draft}->>'slug' = ${slug}`,
        )
        .limit(1);
      return row ? fromRow(row, true) : null;
    }
    const [row] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);
    if (!row || row.status !== "published") return null;
    return fromRow(row);
  } catch (err) {
    console.warn("[press] DB read failed for slug", slug, err);
    return null;
  }
}
