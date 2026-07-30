CREATE TABLE "chat_file" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"message_id" text,
	"user_id" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_file_file_id_unique" UNIQUE("file_id")
);
--> statement-breakpoint
ALTER TABLE "drive_file" ADD COLUMN "source" text DEFAULT 'drive_raw';--> statement-breakpoint
ALTER TABLE "chat_file" ADD CONSTRAINT "chat_file_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_file" ADD CONSTRAINT "chat_file_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;