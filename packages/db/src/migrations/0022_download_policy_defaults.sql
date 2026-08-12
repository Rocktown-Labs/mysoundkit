ALTER TABLE "tracks"
  ALTER COLUMN "downloads_require_first_play" SET DEFAULT true;

ALTER TABLE "tracks"
  ALTER COLUMN "downloads_require_purchase" SET DEFAULT false;
