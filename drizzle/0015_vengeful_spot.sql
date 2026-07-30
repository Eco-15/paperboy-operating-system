CREATE TYPE "public"."subscriber_list" AS ENUM('deals', 'jobs', 'talent');--> statement-breakpoint
CREATE TABLE "job_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"contact_email" text NOT NULL,
	"role_title" text NOT NULL,
	"link" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriber" DROP CONSTRAINT "subscriber_email_unique";--> statement-breakpoint
ALTER TABLE "subscriber" ADD COLUMN "list" "subscriber_list" DEFAULT 'deals' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriber" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "subscriber" ADD COLUMN "note" text;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriber_email_list_idx" ON "subscriber" USING btree ("email","list");