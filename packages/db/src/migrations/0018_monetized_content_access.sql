DO $$ BEGIN
  CREATE TYPE "public"."listening_access" AS ENUM('public', 'premium_or_purchased');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "listening_access" "public"."listening_access" DEFAULT 'public' NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "exclusive_until" timestamp;
--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "listening_access" "public"."listening_access" DEFAULT 'public' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "exclusive_until" timestamp;
