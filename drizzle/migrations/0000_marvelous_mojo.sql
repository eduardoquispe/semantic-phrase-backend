CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "phrases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"normalized_text" text NOT NULL,
	"embedding" vector(384) NOT NULL,
	"model_id" varchar(255) NOT NULL,
	"model_version" varchar(150) NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "phrases_normalized_text_idx" ON "phrases" USING btree ("normalized_text");
