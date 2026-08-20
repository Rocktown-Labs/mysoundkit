DO $$ BEGIN
  CREATE TYPE "battle_queue_entry_status" AS ENUM (
    'queued', 'admitted', 'left', 'removed', 'completed', 'conflict'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "battle_queue_entries" (
  "admitted_at" timestamp,
  "battle_id" text NOT NULL,
  "completed_at" timestamp,
  "conflict_battle_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "id" text PRIMARY KEY NOT NULL,
  "left_at" timestamp,
  "position" integer DEFAULT 0 NOT NULL,
  "status" "battle_queue_entry_status" DEFAULT 'queued' NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "user_id" text NOT NULL
);

ALTER TABLE "battle_queue_entries"
  ADD CONSTRAINT "battle_queue_entries_battle_id_battles_id_fk"
  FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE cascade;
ALTER TABLE "battle_queue_entries"
  ADD CONSTRAINT "battle_queue_entries_conflict_battle_id_battles_id_fk"
  FOREIGN KEY ("conflict_battle_id") REFERENCES "battles"("id") ON DELETE set null;
ALTER TABLE "battle_queue_entries"
  ADD CONSTRAINT "battle_queue_entries_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade;

CREATE UNIQUE INDEX IF NOT EXISTS "battle_queue_entries_battle_user_idx"
  ON "battle_queue_entries" ("battle_id", "user_id");
CREATE INDEX IF NOT EXISTS "battle_queue_entries_battle_status_idx"
  ON "battle_queue_entries" ("battle_id", "status", "position");
CREATE INDEX IF NOT EXISTS "battle_queue_entries_user_status_idx"
  ON "battle_queue_entries" ("user_id", "status");
