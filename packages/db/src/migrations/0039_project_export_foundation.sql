ALTER TYPE "public"."project_asset_kind" ADD VALUE 'release_export';--> statement-breakpoint
ALTER TABLE "project_assets" ALTER COLUMN "size_bytes" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN "export_version" integer;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN "source_asset_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "export_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_source_asset_id_track_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."track_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_assets_export_identity_idx" ON "project_assets" USING btree ("project_id","source_asset_id","export_version","asset_kind");