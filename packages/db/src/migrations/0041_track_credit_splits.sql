ALTER TABLE "notification_settings" ADD COLUMN "email_live" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "email_messages" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "track_collaborators" ADD COLUMN "credit_split_bps" integer;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN "actor_user_id" text;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN "aggregation_key" text;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN "entity_id" text;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN "entity_type" text;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_participants_user_conversation_idx" ON "conversation_participants" USING btree ("user_id","conversation_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_at_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "user_notifications_user_created_idx" ON "user_notifications" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "user_notifications_user_read_created_idx" ON "user_notifications" USING btree ("user_id","read","created_at");--> statement-breakpoint
CREATE INDEX "user_notifications_user_aggregation_idx" ON "user_notifications" USING btree ("user_id","aggregation_key","created_at");