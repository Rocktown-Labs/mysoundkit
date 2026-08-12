ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "genre_id" text REFERENCES "genres"("id") ON DELETE SET NULL;
ALTER TABLE "listening_parties" ADD COLUMN IF NOT EXISTS "genre_id" text REFERENCES "genres"("id") ON DELETE SET NULL;
UPDATE "tracks" SET "downloads_require_purchase" = false, "downloads_require_first_play" = true WHERE "is_for_sale" = false;
