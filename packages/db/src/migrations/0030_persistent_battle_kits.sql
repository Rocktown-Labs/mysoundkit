CREATE TYPE "public"."battle_kit_track_role" AS ENUM('main', 'tiebreaker');--> statement-breakpoint
ALTER TABLE "battle_kits" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "battle_kits" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "battle_kit_tracks" ADD COLUMN "main_slot" integer;--> statement-breakpoint
ALTER TABLE "battle_kit_tracks" ADD COLUMN "role" "battle_kit_track_role" DEFAULT 'main' NOT NULL;--> statement-breakpoint
UPDATE "battle_kits" AS kits
SET "owner_user_id" = owners."user_id"
FROM (
  SELECT DISTINCT ON ("organization_id") "organization_id", "user_id"
  FROM "member"
  WHERE "role" = 'owner'
  ORDER BY "organization_id", "created_at"
) AS owners
WHERE kits."organization_id" = owners."organization_id"
  AND kits."owner_user_id" IS NULL;--> statement-breakpoint
WITH ranked_tracks AS (
  SELECT
    "id",
    row_number() OVER (PARTITION BY "battle_kit_id" ORDER BY "seed_order", "created_at", "id")::integer AS slot
  FROM "battle_kit_tracks"
)
UPDATE "battle_kit_tracks" AS tracks
SET "main_slot" = ranked_tracks."slot"
FROM ranked_tracks
WHERE tracks."id" = ranked_tracks."id";--> statement-breakpoint
ALTER TABLE "battle_kits" ADD CONSTRAINT "battle_kits_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_experiences" ADD CONSTRAINT "live_experiences_battle_kit_id_battle_kits_id_fk" FOREIGN KEY ("battle_kit_id") REFERENCES "public"."battle_kits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "battle_kits_owner_user_id_idx" ON "battle_kits" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "battle_kit_tracks_kit_track_idx" ON "battle_kit_tracks" USING btree ("battle_kit_id", "track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "battle_kit_tracks_tiebreaker_idx" ON "battle_kit_tracks" USING btree ("battle_kit_id") WHERE "role" = 'tiebreaker';--> statement-breakpoint
CREATE UNIQUE INDEX "battle_kit_tracks_main_slot_idx" ON "battle_kit_tracks" USING btree ("battle_kit_id", "main_slot") WHERE "role" = 'main' AND "main_slot" IS NOT NULL;
