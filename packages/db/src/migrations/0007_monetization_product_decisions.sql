ALTER TABLE "video_ad_campaigns" ALTER COLUMN "status" SET DEFAULT 'pending_review';

UPDATE "plan_catalog"
SET "annual_price_cents" = 18000
WHERE "code" IN ('soundkit_premium_artist', 'soundkit_premium_fan');

UPDATE "plan_catalog_v2"
SET "annual_price_cents" = 18000
WHERE "code" IN ('soundkit_premium_artist', 'soundkit_premium_fan');
