ALTER TABLE "tracks" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "purge_after" timestamp;