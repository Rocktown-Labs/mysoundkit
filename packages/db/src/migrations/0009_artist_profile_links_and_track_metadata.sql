ALTER TABLE "artist_profiles" ADD COLUMN IF NOT EXISTS "pro_affiliation" text;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN IF NOT EXISTS "pro_member_id" text;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN IF NOT EXISTS "songwriter_legal_name" text;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "isrc" text;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "streaming_links" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "streaming_links" jsonb DEFAULT '{}'::jsonb NOT NULL;
