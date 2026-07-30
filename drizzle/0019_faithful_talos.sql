ALTER TABLE "blog_post" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "blog_post" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "blog_post" ADD COLUMN "excerpt" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_post" ADD COLUMN "draft" jsonb;--> statement-breakpoint
ALTER TABLE "blog_post" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "blog_post" ADD CONSTRAINT "blog_post_slug_unique" UNIQUE("slug");--> statement-breakpoint
-- Hand-added backfill: pre-existing rows are placeholder/internal posts with no
-- slug or excerpt — demote them to draft so the now-DB-driven public /press
-- pages don't surface them until someone deliberately publishes.
UPDATE "blog_post" SET "status" = 'draft';