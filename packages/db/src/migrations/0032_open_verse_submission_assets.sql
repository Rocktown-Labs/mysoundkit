ALTER TABLE "open_verse_submissions"
  ADD COLUMN IF NOT EXISTS "vocal_stem_asset_id" text
  REFERENCES "track_assets"("id") ON DELETE SET NULL;

ALTER TABLE "open_verse_submissions"
  ADD COLUMN IF NOT EXISTS "adlib_asset_id" text
  REFERENCES "track_assets"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "open_verse_submissions_vocal_stem_asset_id_idx"
  ON "open_verse_submissions" ("vocal_stem_asset_id");

CREATE INDEX IF NOT EXISTS "open_verse_submissions_adlib_asset_id_idx"
  ON "open_verse_submissions" ("adlib_asset_id");
