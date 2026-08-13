UPDATE "plan_catalog_v2"
SET
  "annual_price_cents" = 22899,
  "is_active" = true,
  "monthly_price_cents" = 2299,
  "entitlements" = CASE
    WHEN "code" = 'soundkit_premium_artist'
      THEN '{"canCreateLiveBattles":true,"canHostLiveStreams":true}'::jsonb
    ELSE '{"accessExclusiveLiveBattles":true,"listeningPartiesUnlimited":true,"voteInBattleRounds":true}'::jsonb
  END
WHERE "code" IN ('soundkit_premium_artist', 'soundkit_premium_fan');

UPDATE "plan_catalog_v2"
SET "is_active" = false
WHERE "code" IN ('artist_team', 'fan_family');

UPDATE "plan_catalog"
SET "monthly_price" = '22.99'
WHERE "code" IN ('soundkit_premium_artist', 'soundkit_premium_fan');
