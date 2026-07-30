ALTER TABLE "brand_app" ADD COLUMN "fund" text;--> statement-breakpoint
ALTER TABLE "brand_app" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "parts" jsonb;--> statement-breakpoint
ALTER TABLE "inquiry" ADD COLUMN "fund" text;--> statement-breakpoint
ALTER TABLE "inquiry" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;