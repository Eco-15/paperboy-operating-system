import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";
import type { BlogPost } from "@/lib/blog/types";
import { toBlogPost, uniqueSlug } from "@/lib/blog/server";
import { isConfigured, listPosts } from "@/lib/beehiiv/client";
import { formatUnix } from "@/lib/newsletter/types";

// Plain-text excerpt from Beehiiv HTML (cards show excerpts, not full HTML).
function excerpt(html: string, max = 240): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "’")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

// Any signed-in user can read the feed — local DB posts (drafts included; this
// is the internal view) merged with the Beehiiv archive when configured.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
  const items: { post: BlogPost; ts: number }[] = rows.map((r) => ({
    post: toBlogPost(r),
    ts: r.createdAt ? new Date(r.createdAt).getTime() : 0,
  }));

  if (isConfigured()) {
    try {
      const res = await listPosts({ status: "confirmed", limit: 25 });
      for (const p of res.data ?? []) {
        const web = p.content?.free?.web ?? "";
        if (!web) continue;
        items.push({
          post: {
            id: `bh_${p.id}`,
            title: p.title,
            category: p.content_tags?.[0] ?? "Newsletter",
            date: p.publish_date ? formatUnix(p.publish_date) : "",
            image: p.thumbnail_url ?? "",
            body: excerpt(web),
            slug: null,
            excerpt: excerpt(web),
            status: "published",
            source: "beehiiv",
            publishedAt: p.publish_date
              ? new Date(p.publish_date * 1000).toISOString()
              : null,
            hasUnpublishedChanges: false,
          },
          ts: (p.publish_date ?? 0) * 1000,
        });
      }
    } catch {
      /* Beehiiv unreachable — show local posts only */
    }
  }

  items.sort((a, b) => b.ts - a.ts);
  return NextResponse.json({ posts: items.map((x) => x.post) });
}

const createSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  date: z.string().optional(),
  image: z.string().optional(),
  body: z.string().optional(),
});

// Staff create a post as a draft; all further editing goes through
// PATCH /api/blog/[id] (draft jsonb) and POST /api/blog/[id]/publish.
export async function POST(req: Request) {
  const user = await staffApiUser();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  const slug = await uniqueSlug(d.title);

  const [row] = await db
    .insert(blogPosts)
    .values({
      authorId: user.id,
      title: d.title,
      category: d.category,
      displayDate: d.date || null,
      imageUrl: d.image || "",
      body: d.body || "",
      status: "draft",
      draft: {
        title: d.title,
        category: d.category,
        slug,
        excerpt: "",
        displayDate: d.date || "",
        imageUrl: d.image || "",
        body: d.body || "",
      },
    })
    .returning();

  return NextResponse.json({ post: toBlogPost(row) }, { status: 201 });
}
