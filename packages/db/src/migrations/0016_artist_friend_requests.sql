CREATE TYPE "public"."artist_friend_request_status" AS ENUM('pending', 'accepted', 'declined', 'canceled');--> statement-breakpoint
CREATE TABLE "artist_friend_requests" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"message" text,
	"recipient_user_id" text NOT NULL,
	"requester_user_id" text NOT NULL,
	"responded_at" timestamp,
	"status" "artist_friend_request_status" DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artist_friend_requests" ADD CONSTRAINT "artist_friend_requests_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_friend_requests" ADD CONSTRAINT "artist_friend_requests_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artist_friend_requests_recipient_status_idx" ON "artist_friend_requests" USING btree ("recipient_user_id","status");--> statement-breakpoint
CREATE INDEX "artist_friend_requests_requester_status_idx" ON "artist_friend_requests" USING btree ("requester_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "artist_friend_requests_pair_idx" ON "artist_friend_requests" USING btree ("requester_user_id","recipient_user_id");
