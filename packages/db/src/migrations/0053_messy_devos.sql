CREATE TYPE "public"."collaboration_kind" AS ENUM('project', 'track');--> statement-breakpoint
CREATE TABLE "collaboration_proposals" (
	"client_request_id" text,
	"collaboration_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"invitee_user_id" text NOT NULL,
	"inviter_user_id" text NOT NULL,
	"kind" "collaboration_kind" NOT NULL,
	"message_id" text,
	"responded_at" timestamp,
	"status" "app_invitation_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collaboration_proposals" ADD CONSTRAINT "collaboration_proposals_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_proposals" ADD CONSTRAINT "collaboration_proposals_invitee_user_id_user_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_proposals" ADD CONSTRAINT "collaboration_proposals_inviter_user_id_user_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_proposals" ADD CONSTRAINT "collaboration_proposals_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collaboration_proposals_conversation_status_idx" ON "collaboration_proposals" USING btree ("conversation_id","status");--> statement-breakpoint
CREATE INDEX "collaboration_proposals_expires_status_idx" ON "collaboration_proposals" USING btree ("expires_at","status");--> statement-breakpoint
CREATE INDEX "collaboration_proposals_target_idx" ON "collaboration_proposals" USING btree ("collaboration_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "collaboration_proposals_request_idx" ON "collaboration_proposals" USING btree ("inviter_user_id","invitee_user_id","client_request_id");