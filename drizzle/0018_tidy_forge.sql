CREATE TABLE "site_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"bytes" "bytea" NOT NULL,
	"alt" text,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_page_version" (
	"id" text PRIMARY KEY NOT NULL,
	"page_slug" text NOT NULL,
	"content" jsonb NOT NULL,
	"published_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_page" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"draft_saved_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_page_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "site_asset" ADD CONSTRAINT "site_asset_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_page_version" ADD CONSTRAINT "site_page_version_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_page" ADD CONSTRAINT "site_page_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_page_version_idx" ON "site_page_version" USING btree ("page_slug","created_at");