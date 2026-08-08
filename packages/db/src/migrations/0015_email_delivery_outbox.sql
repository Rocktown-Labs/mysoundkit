CREATE TYPE "public"."email_delivery_status" AS ENUM('queued', 'sending', 'sent', 'failed', 'canceled');--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"error" text,
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"last_attempt_at" timestamp,
	"next_attempt_at" timestamp,
	"payload" jsonb NOT NULL,
	"provider" text DEFAULT 'resend' NOT NULL,
	"provider_message_id" text,
	"recipient_email" text NOT NULL,
	"recipient_name" text,
	"sent_at" timestamp,
	"status" "email_delivery_status" DEFAULT 'queued' NOT NULL,
	"template" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text
);
--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_idempotency_key_idx" ON "email_deliveries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "email_deliveries_status_next_attempt_idx" ON "email_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "email_deliveries_user_id_idx" ON "email_deliveries" USING btree ("user_id");
