DO $$ BEGIN
  CREATE TYPE "creator_eligibility" AS ENUM ('independent', 'major_label_affiliated');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "onboarding_progress" (
  "completed_at" timestamp,
  "creator_eligibility" "creator_eligibility",
  "creator_eligibility_declared_at" timestamp,
  "creator_eligibility_locked_at" timestamp,
  "current_step" integer DEFAULT 1 NOT NULL,
  "exited_at" timestamp,
  "intended_account_type" "account_type" NOT NULL,
  "last_activity_at" timestamp DEFAULT now() NOT NULL,
  "marketing_opt_in" boolean DEFAULT false NOT NULL,
  "marketing_opt_in_at" timestamp,
  "marketing_opt_in_source" text,
  "marketing_opt_in_version" text,
  "rights_attested_at" timestamp,
  "rights_attestation_version" text,
  "selected_plan_code" text,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "user_id" text PRIMARY KEY NOT NULL
);

ALTER TABLE "onboarding_progress"
  ADD CONSTRAINT "onboarding_progress_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade;

CREATE INDEX IF NOT EXISTS "onboarding_progress_last_activity_idx"
  ON "onboarding_progress" ("last_activity_at");

CREATE TABLE IF NOT EXISTS "onboarding_email_reminders" (
  "id" text PRIMARY KEY NOT NULL,
  "reminder_type" text NOT NULL,
  "sent_at" timestamp DEFAULT now() NOT NULL,
  "user_id" text NOT NULL
);

ALTER TABLE "onboarding_email_reminders"
  ADD CONSTRAINT "onboarding_email_reminders_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade;

CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_email_reminders_user_type_idx"
  ON "onboarding_email_reminders" ("user_id", "reminder_type");

UPDATE "plan_catalog_v2"
SET "max_seats" = 5
WHERE "code" IN ('soundkit_premium_artist', 'soundkit_premium_fan');

INSERT INTO "plan_catalog_v2"
  ("annual_price_cents", "audience", "code", "entitlements", "is_active", "max_seats", "monthly_price_cents", "name")
VALUES
  (0, 'artist', 'artist_free', '{}'::jsonb, true, 1, 0, 'SoundKit Free Artist'),
  (0, 'fan', 'fan_free', '{}'::jsonb, true, 1, 0, 'SoundKit Free Fan')
ON CONFLICT ("code") DO UPDATE SET
  "annual_price_cents" = excluded."annual_price_cents",
  "entitlements" = excluded."entitlements",
  "is_active" = true,
  "max_seats" = excluded."max_seats",
  "monthly_price_cents" = excluded."monthly_price_cents",
  "name" = excluded."name";
