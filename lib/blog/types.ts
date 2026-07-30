import type { BlogDraft } from "@/lib/db/schema";

export type { BlogDraft };

export interface BlogPost {
  id: string;
  title: string;
  category: string; // e.g. "DEALS", "Guide", "News"
  date: string; // display date, e.g. "3/10/26"
  image: string; // cover image URL ("" = render a placeholder)
  body: string;
  slug: string | null;
  excerpt: string;
  status: "draft" | "published";
  source: "db" | "beehiiv";
  publishedAt: string | null;
  // True when the draft jsonb differs from what's live (edits since publish).
  hasUnpublishedChanges: boolean;
}
