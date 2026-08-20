ALTER TYPE "webhook_provider" ADD VALUE IF NOT EXISTS 'cloudflare_stream';

ALTER TABLE "live_experiences"
  ADD COLUMN IF NOT EXISTS "ingest_error_code" text,
  ADD COLUMN IF NOT EXISTS "ingest_error_message" text,
  ADD COLUMN IF NOT EXISTS "ingest_status" text DEFAULT 'idle' NOT NULL,
  ADD COLUMN IF NOT EXISTS "reconnect_until" timestamp,
  ADD COLUMN IF NOT EXISTS "replay_published_at" timestamp,
  ADD COLUMN IF NOT EXISTS "started_at" timestamp;
