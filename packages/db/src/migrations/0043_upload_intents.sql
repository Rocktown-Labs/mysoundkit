CREATE TABLE "upload_intents" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"entity_id" text,
	"expires_at" timestamp NOT NULL,
	"file_name" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"mime_type" text,
	"object_key" text NOT NULL,
	"registered_at" timestamp,
	"registered_entity_id" text,
	"registered_entity_type" text,
	"route" text NOT NULL,
	"size_bytes" bigint,
	"status" text DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text
);
--> statement-breakpoint
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "upload_intents_object_key_idx" ON "upload_intents" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "upload_intents_status_expires_idx" ON "upload_intents" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "upload_intents_user_created_idx" ON "upload_intents" USING btree ("user_id","created_at");