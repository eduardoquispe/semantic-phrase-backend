ALTER TABLE "phrases" ADD COLUMN "status" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "phrases" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "phrases" ADD CONSTRAINT "phrases_status_check" CHECK ("phrases"."status" IN (1, 2));