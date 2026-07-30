CREATE TABLE "inquiry" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"email" text NOT NULL,
	"company" text,
	"position" text,
	"accredited" boolean,
	"deck_name" text,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
