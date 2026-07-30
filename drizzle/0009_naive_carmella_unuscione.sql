CREATE TABLE "sync_channel" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"service" text NOT NULL,
	"channel_id" text NOT NULL,
	"resource_id" text,
	"expiration" timestamp,
	"last_history_id" text,
	"last_page_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sync_channel_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
ALTER TABLE "sync_channel" ADD CONSTRAINT "sync_channel_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;