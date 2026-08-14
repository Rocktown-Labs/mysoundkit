CREATE TABLE IF NOT EXISTS "message_attachments" (
  "created_at" timestamp DEFAULT now() NOT NULL,
  "display_name" text NOT NULL,
  "id" text PRIMARY KEY NOT NULL,
  "message_id" text NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "mime_type" text,
  "object_key" text,
  "size_bytes" integer,
  "source_project_id" text REFERENCES "projects"("id") ON DELETE SET NULL,
  "source_track_id" text REFERENCES "tracks"("id") ON DELETE SET NULL,
  "url" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "message_attachments_message_id_idx"
ON "message_attachments" ("message_id");
