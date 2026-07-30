CREATE TABLE "google_credential" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email" text,
	"refresh_token" text NOT NULL,
	"access_token" text,
	"expiry_date" bigint,
	"scope" text,
	"connected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "google_credential" ADD CONSTRAINT "google_credential_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;