CREATE TYPE "public"."audio_diagnostic_job_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "audio_diagnostic_jobs" (
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text,
	"error" text,
	"id" text PRIMARY KEY NOT NULL,
	"progress_done" integer DEFAULT 0 NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "audio_diagnostic_job_status" DEFAULT 'queued' NOT NULL,
	"tests" jsonb NOT NULL,
	"track_ids" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audio_diagnostic_jobs" ADD CONSTRAINT "audio_diagnostic_jobs_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audio_diagnostic_jobs_status_idx" ON "audio_diagnostic_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audio_diagnostic_jobs_created_by_idx" ON "audio_diagnostic_jobs" USING btree ("created_by_user_id");