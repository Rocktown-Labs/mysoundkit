ALTER TABLE "user_profiles"
ADD COLUMN IF NOT EXISTS "media_layout" text DEFAULT 'cards' NOT NULL;

ALTER TABLE "user_profiles"
ADD CONSTRAINT "user_profiles_media_layout_check"
CHECK ("media_layout" IN ('cards', 'list'));
