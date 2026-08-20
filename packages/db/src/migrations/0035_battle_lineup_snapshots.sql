CREATE TABLE IF NOT EXISTS "battle_lineup_snapshots" (
  "artist_user_id" text NOT NULL,
  "battle_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "format" "battle_format" NOT NULL,
  "id" text PRIMARY KEY NOT NULL,
  "kit_id" text NOT NULL,
  "tracks" jsonb NOT NULL
);

ALTER TABLE "battle_lineup_snapshots"
  ADD CONSTRAINT "battle_lineup_snapshots_artist_user_id_user_id_fk"
  FOREIGN KEY ("artist_user_id") REFERENCES "user"("id") ON DELETE cascade;
ALTER TABLE "battle_lineup_snapshots"
  ADD CONSTRAINT "battle_lineup_snapshots_battle_id_battles_id_fk"
  FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE cascade;
ALTER TABLE "battle_lineup_snapshots"
  ADD CONSTRAINT "battle_lineup_snapshots_kit_id_battle_kits_id_fk"
  FOREIGN KEY ("kit_id") REFERENCES "battle_kits"("id") ON DELETE restrict;
CREATE UNIQUE INDEX IF NOT EXISTS "battle_lineup_snapshots_battle_artist_idx"
  ON "battle_lineup_snapshots" ("battle_id", "artist_user_id");
