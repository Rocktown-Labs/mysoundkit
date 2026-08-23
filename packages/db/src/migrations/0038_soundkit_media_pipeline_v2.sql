CREATE TYPE "public"."media_asset_purpose" AS ENUM('master', 'streaming', 'battle', 'download', 'lossless_download', 'open_verse_snippet', 'preview', 'stem', 'artwork', 'other');--> statement-breakpoint
CREATE TYPE "public"."media_processing_job_status" AS ENUM('queued', 'running', 'ready', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."media_processing_mode" AS ENUM('final_track', 'open_verse_base', 'legacy_backfill');--> statement-breakpoint
CREATE TYPE "public"."media_workflow_type" AS ENUM('media_processing', 'track_enrichment', 'project_export', 'media_retention');--> statement-breakpoint
ALTER TYPE "public"."open_verse_status" ADD VALUE IF NOT EXISTS 'awaiting_final_master';--> statement-breakpoint
CREATE TABLE "media_processing_jobs" (
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"current_stage" text,
	"error_code" text,
	"error_message" text,
	"export_version" integer,
	"id" text PRIMARY KEY NOT NULL,
	"input" jsonb,
	"mode" "media_processing_mode",
	"output" jsonb,
	"pipeline_version" integer NOT NULL,
	"progress_percent" numeric(5, 2),
	"project_id" text,
	"source_asset_id" text,
	"started_at" timestamp,
	"status" "media_processing_job_status" DEFAULT 'queued' NOT NULL,
	"track_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"workflow_instance_id" text NOT NULL,
	"workflow_type" "media_workflow_type" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "open_verse_listings" ADD COLUMN "base_master_asset_id" text;--> statement-breakpoint
ALTER TABLE "track_assets" ALTER COLUMN "size_bytes" SET DATA TYPE bigint USING "size_bytes"::bigint;--> statement-breakpoint
ALTER TABLE "track_assets" ADD COLUMN "integrated_lufs" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "track_assets" ADD COLUMN "is_current" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "track_assets" ADD COLUMN "normalization_target_lufs" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "track_assets" ADD COLUMN "processing_version" integer;--> statement-breakpoint
ALTER TABLE "track_assets" ADD COLUMN "purpose" "media_asset_purpose";--> statement-breakpoint
ALTER TABLE "track_assets" ADD COLUMN "source_asset_id" text;--> statement-breakpoint
ALTER TABLE "track_assets" ADD COLUMN "true_peak_dbtp" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "open_verse_listings" ADD CONSTRAINT "open_verse_listings_base_master_asset_id_track_assets_id_fk" FOREIGN KEY ("base_master_asset_id") REFERENCES "public"."track_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
UPDATE "open_verse_listings" AS listing
SET "base_master_asset_id" = COALESCE(
	(
		SELECT preview."source_asset_id"
		FROM "track_assets" AS preview
		WHERE preview."id" = listing."preview_asset_id"
	),
	(
		SELECT master."id"
		FROM "track_assets" AS master
		WHERE master."track_id" = listing."track_id"
			AND master."asset_kind" = 'master'
		ORDER BY master."is_current" DESC, master."updated_at" DESC
		LIMIT 1
	)
)
WHERE listing."base_master_asset_id" IS NULL;--> statement-breakpoint
ALTER TABLE "media_processing_jobs" ADD CONSTRAINT "media_processing_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_processing_jobs" ADD CONSTRAINT "media_processing_jobs_source_asset_id_track_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."track_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_processing_jobs" ADD CONSTRAINT "media_processing_jobs_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_assets" ADD CONSTRAINT "track_assets_source_asset_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."track_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
UPDATE "track_assets"
SET "purpose" = CASE
	WHEN "asset_kind" = 'master' THEN 'master'::"media_asset_purpose"
	WHEN "asset_kind" IN ('cover_art', 'artwork') THEN 'artwork'::"media_asset_purpose"
	WHEN "asset_kind" = 'open_verse_clip' THEN 'open_verse_snippet'::"media_asset_purpose"
	WHEN "asset_kind" = 'variant_audio' THEN 'preview'::"media_asset_purpose"
	ELSE NULL
END
WHERE "purpose" IS NULL;--> statement-breakpoint
WITH ranked_assets AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "track_id", "purpose", "asset_kind"
			ORDER BY
				CASE "status" WHEN 'ready' THEN 0 WHEN 'uploaded' THEN 1 ELSE 2 END,
				"updated_at" DESC,
				"created_at" DESC
		) AS "rank"
	FROM "track_assets"
	WHERE "purpose" IS NOT NULL
)
UPDATE "track_assets"
SET "is_current" = false
FROM ranked_assets
WHERE "track_assets"."id" = ranked_assets."id"
	AND ranked_assets."rank" > 1;--> statement-breakpoint
CREATE INDEX "media_processing_jobs_project_idx" ON "media_processing_jobs" USING btree ("project_id","workflow_type","export_version");--> statement-breakpoint
CREATE INDEX "media_processing_jobs_track_idx" ON "media_processing_jobs" USING btree ("track_id","workflow_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "media_processing_jobs_track_identity_idx" ON "media_processing_jobs" USING btree ("workflow_type","track_id","source_asset_id","pipeline_version","mode");--> statement-breakpoint
CREATE UNIQUE INDEX "media_processing_jobs_project_identity_idx" ON "media_processing_jobs" USING btree ("workflow_type","project_id","export_version");--> statement-breakpoint
CREATE UNIQUE INDEX "media_processing_jobs_workflow_instance_idx" ON "media_processing_jobs" USING btree ("workflow_type","workflow_instance_id");--> statement-breakpoint
CREATE INDEX "track_assets_source_asset_id_idx" ON "track_assets" USING btree ("source_asset_id");--> statement-breakpoint
CREATE INDEX "track_assets_purpose_current_idx" ON "track_assets" USING btree ("track_id","purpose","is_current");--> statement-breakpoint
CREATE UNIQUE INDEX "track_assets_current_purpose_idx" ON "track_assets" USING btree ("track_id","purpose","asset_kind") WHERE "track_assets"."is_current" = true and "track_assets"."purpose" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "track_assets_derivative_identity_idx" ON "track_assets" USING btree ("track_id","source_asset_id","purpose","processing_version","asset_kind");--> statement-breakpoint
DROP INDEX IF EXISTS "track_stem_jobs_input_asset_id_idx";--> statement-breakpoint
WITH ranked_stem_jobs AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "input_asset_id"
			ORDER BY
				CASE "status" WHEN 'completed' THEN 0 WHEN 'processing' THEN 1 WHEN 'submitted' THEN 2 WHEN 'queued' THEN 3 ELSE 4 END,
				"updated_at" DESC,
				"created_at" DESC
		) AS "rank"
	FROM "track_stem_jobs"
)
DELETE FROM "track_stem_jobs"
USING ranked_stem_jobs
WHERE "track_stem_jobs"."id" = ranked_stem_jobs."id"
	AND ranked_stem_jobs."rank" > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "track_stem_jobs_input_asset_id_idx" ON "track_stem_jobs" USING btree ("input_asset_id");
