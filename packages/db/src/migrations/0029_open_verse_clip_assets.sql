DO $$
BEGIN
  ALTER TYPE "track_asset_kind" ADD VALUE IF NOT EXISTS 'open_verse_clip';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "open_verse_access_mode" AS ENUM ('open', 'approval_required');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "open_verse_listings"
  ADD COLUMN IF NOT EXISTS "access_mode" "open_verse_access_mode" NOT NULL DEFAULT 'open';

ALTER TABLE "open_verse_listings"
  ADD COLUMN IF NOT EXISTS "preview_asset_id" text
  REFERENCES "track_assets"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "open_verse_listings_preview_asset_id_idx"
  ON "open_verse_listings" ("preview_asset_id");

DO $$
BEGIN
  CREATE TYPE "open_verse_access_request_status" AS ENUM ('pending', 'approved', 'declined', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "open_verse_access_requests" (
  "created_at" timestamp DEFAULT now() NOT NULL,
  "id" text PRIMARY KEY NOT NULL,
  "listing_id" text NOT NULL REFERENCES "open_verse_listings"("id") ON DELETE CASCADE,
  "message" text,
  "requester_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "reviewed_at" timestamp,
  "reviewed_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "status" "open_verse_access_request_status" DEFAULT 'pending' NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "open_verse_access_requests_listing_id_idx"
  ON "open_verse_access_requests" ("listing_id");
CREATE UNIQUE INDEX IF NOT EXISTS "open_verse_access_requests_listing_requester_idx"
  ON "open_verse_access_requests" ("listing_id", "requester_user_id");
