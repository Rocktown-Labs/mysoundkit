ALTER TYPE "public"."webhook_provider" ADD VALUE 'resend';--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "email_track_processing" boolean DEFAULT true NOT NULL;
