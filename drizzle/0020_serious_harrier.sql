CREATE TABLE "talent" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"company" text,
	"email" text,
	"link" text,
	"location" text,
	"source" text,
	"priority" integer,
	"stage" text,
	"notes" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
