ALTER TYPE "public"."project_asset_kind" ADD VALUE 'beat' BEFORE 'release_export';--> statement-breakpoint
ALTER TYPE "public"."project_asset_kind" ADD VALUE 'concept' BEFORE 'release_export';--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN "is_current" boolean DEFAULT true NOT NULL;