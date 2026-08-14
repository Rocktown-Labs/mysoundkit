ALTER TABLE "listening_parties"
ALTER COLUMN "project_id" DROP NOT NULL;

ALTER TABLE "listening_parties"
ADD COLUMN IF NOT EXISTS "playlist_id" text REFERENCES "playlists"("id") ON DELETE CASCADE;

ALTER TABLE "listening_parties"
ADD CONSTRAINT "listening_parties_source_check"
CHECK (
  ("project_id" IS NOT NULL AND "playlist_id" IS NULL)
  OR ("project_id" IS NULL AND "playlist_id" IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS "listening_parties_playlist_id_idx"
ON "listening_parties" ("playlist_id");
