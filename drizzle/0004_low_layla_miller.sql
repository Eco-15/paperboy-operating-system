CREATE TABLE "brand_app" (
	"id" text PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"category" text,
	"subcategory" text,
	"source" text,
	"priority" integer,
	"stage" text,
	"contact_name" text,
	"contact_email" text,
	"message" text,
	"pitchdeck_link" text,
	"pitchdeck_file" text,
	"website" text,
	"date_submitted" text,
	"ai_one_pager" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
