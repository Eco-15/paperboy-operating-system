CREATE TABLE "event_pairing" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"group_number" integer NOT NULL,
	"tee_time" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_rsvp" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text,
	"role" text,
	"wants_to_play" boolean DEFAULT false,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"pairing_id" text,
	"checked_in_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_score" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"pairing_id" text NOT NULL,
	"hole" integer NOT NULL,
	"strokes" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_sponsor" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"company" text NOT NULL,
	"tier" text,
	"amount" integer,
	"contact_name" text,
	"contact_email" text,
	"deliverables" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"date" timestamp,
	"venue" text,
	"description" text,
	"format" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "event_pairing" ADD CONSTRAINT "event_pairing_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rsvp" ADD CONSTRAINT "event_rsvp_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rsvp" ADD CONSTRAINT "event_rsvp_pairing_id_event_pairing_id_fk" FOREIGN KEY ("pairing_id") REFERENCES "public"."event_pairing"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_score" ADD CONSTRAINT "event_score_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_score" ADD CONSTRAINT "event_score_pairing_id_event_pairing_id_fk" FOREIGN KEY ("pairing_id") REFERENCES "public"."event_pairing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sponsor" ADD CONSTRAINT "event_sponsor_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_rsvp_event_email_idx" ON "event_rsvp" USING btree ("event_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "event_score_pairing_hole_idx" ON "event_score" USING btree ("pairing_id","hole");