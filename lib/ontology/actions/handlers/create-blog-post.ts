import { z } from "zod";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import { uniqueSlug } from "@/lib/blog/server";
import type { ActionHandler } from "../../types";

const schema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  date: z.string().optional(),
  image: z.string().optional(),
  body: z.string().optional(),
});

export const createBlogPost: ActionHandler = async (params, ctx) => {
  const parsed = schema.safeParse(params);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const d = parsed.data;

  // Created as a draft with a seeded draft payload, so agent-created posts
  // flow into the same OS editor / publish pipeline as hand-written ones.
  const slug = await uniqueSlug(d.title);
  const [row] = await db
    .insert(blogPosts)
    .values({
      authorId: ctx.session?.user?.id ?? null,
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

  return {
    ok: true,
    data: { post: { id: row.id, title: row.title, category: row.category } },
    edits: [{ objectType: "BlogPost", objectId: row.id, operation: "create" }],
  };
};
