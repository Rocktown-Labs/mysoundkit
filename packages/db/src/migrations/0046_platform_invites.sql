CREATE TYPE "public"."platform_invite_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "platform_invites" (
  "created_at" timestamp DEFAULT now() NOT NULL,
  "email" text NOT NULL,
  "id" text PRIMARY KEY NOT NULL,
  "inviter_user_id" text NOT NULL,
  "last_attempt_at" timestamp,
  "sent_at" timestamp,
  "status" "platform_invite_status" DEFAULT 'pending' NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "platform_invites" ADD CONSTRAINT "platform_invites_inviter_user_id_user_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_invites_inviter_created_idx" ON "platform_invites" USING btree ("inviter_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_invites_inviter_email_idx" ON "platform_invites" USING btree ("inviter_user_id","email");
