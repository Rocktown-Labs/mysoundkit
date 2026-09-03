UPDATE "plan_catalog_v2"
SET "annual_price_cents" = 18000,
    "updated_at" = now()
WHERE "code" IN ('soundkit_premium_artist', 'soundkit_premium_fan')
  AND "annual_price_cents" IS DISTINCT FROM 18000;
