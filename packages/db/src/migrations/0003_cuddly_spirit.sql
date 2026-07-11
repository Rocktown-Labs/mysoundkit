ALTER TYPE "public"."ad_inventory_type" ADD VALUE 'audio_ad' BEFORE 'video_overlay';--> statement-breakpoint
ALTER TYPE "public"."reward_unit_type" ADD VALUE 'ad_supported_audio_play' BEFORE 'ad_supported_video_view';--> statement-breakpoint
ALTER TABLE "reward_configuration_versions" ALTER COLUMN "premium_price_cents" SET DEFAULT 2299;--> statement-breakpoint
UPDATE "subscription"
SET "plan" = 'soundkit_premium_artist'
WHERE "plan" = 'artist_premium';--> statement-breakpoint
UPDATE "subscription"
SET "plan" = 'soundkit_premium_fan'
WHERE "plan" = 'listener_premium';--> statement-breakpoint
UPDATE "plan_catalog_v2"
SET
  "annual_price_cents" = null,
  "code" = 'soundkit_premium_artist',
  "entitlements" = coalesce("entitlements", '{}'::jsonb) || '{"can_create_live_battles":true,"can_host_live_streams":true,"can_operate_paid_community":true,"can_receive_payouts":true,"can_sell_products":true,"is_premium":true}'::jsonb,
  "monthly_price_cents" = 2299,
  "name" = 'SoundKit Premium Artist',
  "stripe_annual_price_id" = null,
  "updated_at" = now()
WHERE "code" = 'artist_premium';--> statement-breakpoint
UPDATE "plan_catalog_v2"
SET
  "annual_price_cents" = null,
  "code" = 'soundkit_premium_fan',
  "entitlements" = coalesce("entitlements", '{}'::jsonb) || '{"can_watch_creator_streams":true,"can_view_live_battles":true,"can_vote_live_battles":true,"can_watch_vod":true,"is_premium":true}'::jsonb,
  "monthly_price_cents" = 2299,
  "name" = 'SoundKit Premium Fan',
  "stripe_annual_price_id" = null,
  "updated_at" = now()
WHERE "code" = 'listener_premium';--> statement-breakpoint
UPDATE "plan_catalog"
SET
  "code" = 'soundkit_premium_artist',
  "monthly_price" = '22.99',
  "name" = 'SoundKit Premium Artist',
  "stripe_annual_price_id" = null
WHERE "code" = 'artist_premium';--> statement-breakpoint
UPDATE "plan_catalog"
SET
  "code" = 'soundkit_premium_fan',
  "monthly_price" = '22.99',
  "name" = 'SoundKit Premium Fan',
  "stripe_annual_price_id" = null
WHERE "code" = 'listener_premium';
