import { z } from "zod";
import { PRESS_POSTS } from "@/lib/marketing/pressPosts";

// Shared by the blog PATCH/publish routes and the public press store. The
// draft jsonb is written only through this schema so publish can trust it.
export const blogDraftSchema = z.object({
  title: z.string().min(1).max(300),
  category: z.string().min(1).max(60),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, numbers and dashes")
    .max(120),
  excerpt: z.string().max(500),
  displayDate: z.string().max(40),
  imageUrl: z.string().max(2000),
  body: z.string().max(200_000), // markdown
});

export type BlogDraftInput = z.infer<typeof blogDraftSchema>;

// Slugs owned by the hand-imported Squarespace posts — legacy always wins;
// a DB post may never publish under one of these.
export const LEGACY_SLUGS = new Set(PRESS_POSTS.map((p) => p.slug));

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
