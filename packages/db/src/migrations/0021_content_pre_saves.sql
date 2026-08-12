CREATE TABLE IF NOT EXISTS "project_pre_saves" (
  "created_at" timestamp NOT NULL DEFAULT now(),
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  PRIMARY KEY ("user_id", "project_id")
);
CREATE TABLE IF NOT EXISTS "video_pre_saves" (
  "created_at" timestamp NOT NULL DEFAULT now(),
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "video_id" text NOT NULL REFERENCES "videos"("id") ON DELETE CASCADE,
  PRIMARY KEY ("user_id", "video_id")
);
