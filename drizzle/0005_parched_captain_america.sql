CREATE TABLE "news_item" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"source" text,
	"summary" text,
	"why_it_matters" text,
	"category" text,
	"rank" integer DEFAULT 0 NOT NULL,
	"batch_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inquiry" ADD COLUMN "stage" text;