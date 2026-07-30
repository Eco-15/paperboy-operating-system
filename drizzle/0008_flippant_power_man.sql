CREATE TABLE "calendar_event" (
	"id" text PRIMARY KEY NOT NULL,
	"calendar_event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"description" text,
	"start" timestamp,
	"end_time" timestamp,
	"location" text,
	"attendees" jsonb,
	"status" text,
	"html_link" text,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_event_calendar_event_id_unique" UNIQUE("calendar_event_id")
);
--> statement-breakpoint
CREATE TABLE "gmail_message" (
	"id" text PRIMARY KEY NOT NULL,
	"gmail_id" text NOT NULL,
	"user_id" text NOT NULL,
	"thread_id" text,
	"subject" text,
	"from" text,
	"to" jsonb DEFAULT '[]'::jsonb,
	"cc" jsonb DEFAULT '[]'::jsonb,
	"snippet" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb,
	"date" timestamp,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gmail_message_gmail_id_unique" UNIQUE("gmail_id")
);
--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_message" ADD CONSTRAINT "gmail_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;