ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "is_current" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "battles_challenger_status_starts_at_idx" ON "battles" USING btree ("challenger_artist_user_id","status","starts_at");--> statement-breakpoint
CREATE INDEX "battles_opponent_status_starts_at_idx" ON "battles" USING btree ("opponent_artist_user_id","status","starts_at");--> statement-breakpoint
CREATE INDEX "live_experiences_visibility_status_starts_at_idx" ON "live_experiences" USING btree ("visibility","status","starts_at");--> statement-breakpoint
CREATE INDEX "project_assets_cover_lookup_idx" ON "project_assets" USING btree ("project_id","asset_kind","is_current","status","updated_at");--> statement-breakpoint
CREATE INDEX "project_tracks_track_id_idx" ON "project_tracks" USING btree ("track_id");