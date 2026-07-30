ALTER TYPE "public"."user_role" ADD VALUE 'investor';--> statement-breakpoint
CREATE TABLE "lp_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"entity_name" text NOT NULL,
	"contact_name" text,
	"commitment_usd" integer,
	"invested_usd" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lp_profile_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "lp_profile_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "portal_document" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'report' NOT NULL,
	"filename" text,
	"mime" text,
	"size" integer,
	"bytes" "bytea",
	"external_url" text,
	"shared_with_all" boolean DEFAULT false NOT NULL,
	"shared_with" jsonb DEFAULT '[]'::jsonb,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_update" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_company" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"description" text,
	"highlight" text,
	"website" text,
	"logo_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"invested_on" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lp_profile" ADD CONSTRAINT "lp_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_document" ADD CONSTRAINT "portal_document_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_update" ADD CONSTRAINT "portal_update_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;