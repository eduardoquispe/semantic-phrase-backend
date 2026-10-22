CREATE TABLE "phrase_validations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"normalized_text" text NOT NULL,
	"embedding" vector(384) NOT NULL,
	"model_id" varchar(255) NOT NULL,
	"model_version" varchar(150) NOT NULL,
	"matched_phrase_id" uuid,
	"similarity_score" double precision,
	"requires_confirmation" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
