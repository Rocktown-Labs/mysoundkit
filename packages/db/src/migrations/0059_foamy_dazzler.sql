CREATE TYPE "public"."ad_entity_type" AS ENUM('track', 'project', 'video', 'battle', 'stream');--> statement-breakpoint
ALTER TYPE "public"."ad_billing_type" ADD VALUE 'house';--> statement-breakpoint
ALTER TYPE "public"."ad_campaign_status" ADD VALUE 'pending_review' BEFORE 'active';--> statement-breakpoint
ALTER TYPE "public"."ad_campaign_status" ADD VALUE 'rejected' BEFORE 'exhausted_for_today';--> statement-breakpoint
ALTER TYPE "public"."ad_placement" ADD VALUE 'sponsored_queue';--> statement-breakpoint
ALTER TYPE "public"."ad_placement" ADD VALUE 'featured_rail';--> statement-breakpoint
ALTER TYPE "public"."ad_placement" ADD VALUE 'battle_boost';--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD COLUMN "entity_id" text;--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD COLUMN "entity_type" "ad_entity_type";