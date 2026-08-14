CREATE TABLE IF NOT EXISTS "user_follows" (
  "created_at" timestamp DEFAULT now() NOT NULL,
  "follower_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "target_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  CONSTRAINT "user_follows_pk" PRIMARY KEY ("follower_user_id", "target_user_id"),
  CONSTRAINT "user_follows_not_self" CHECK ("follower_user_id" <> "target_user_id")
);

CREATE INDEX IF NOT EXISTS "user_follows_target_idx"
ON "user_follows" ("target_user_id");
