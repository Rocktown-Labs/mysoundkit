CREATE TABLE "notification_email_cooldowns" (
	"last_sent_at" timestamp DEFAULT now() NOT NULL,
	"recipient_user_id" text NOT NULL,
	"scope" text NOT NULL,
	CONSTRAINT "notification_email_cooldowns_recipient_user_id_scope_pk" PRIMARY KEY("recipient_user_id","scope")
);
--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "email_live" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "email_messages" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN "actor_user_id" text;
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN "aggregation_key" text;
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN "entity_id" text;
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN "entity_type" text;
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN "metadata" jsonb;
--> statement-breakpoint
ALTER TABLE "notification_email_cooldowns" ADD CONSTRAINT "notification_email_cooldowns_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "conversation_participants_user_conversation_idx" ON "conversation_participants" USING btree ("user_id","conversation_id");
--> statement-breakpoint
CREATE INDEX "messages_conversation_created_at_idx" ON "messages" USING btree ("conversation_id","created_at");
--> statement-breakpoint
CREATE INDEX "notification_email_cooldowns_last_sent_idx" ON "notification_email_cooldowns" USING btree ("last_sent_at");
--> statement-breakpoint
CREATE INDEX "user_notifications_user_created_idx" ON "user_notifications" USING btree ("user_id","created_at","id");
--> statement-breakpoint
CREATE INDEX "user_notifications_user_read_created_idx" ON "user_notifications" USING btree ("user_id","read","created_at");
--> statement-breakpoint
CREATE INDEX "user_notifications_user_aggregation_idx" ON "user_notifications" USING btree ("user_id","aggregation_key","created_at");
