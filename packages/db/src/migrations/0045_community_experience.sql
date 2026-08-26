ALTER TABLE "communities" ADD COLUMN "cover_image_url" text;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "genre_id" text;--> statement-breakpoint
CREATE TABLE "community_bans" (
  "banned_at" timestamp DEFAULT now() NOT NULL,
  "banned_by_user_id" text NOT NULL,
  "community_id" text NOT NULL,
  "reason" text,
  "user_id" text NOT NULL
);--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_bans" ADD CONSTRAINT "community_bans_banned_by_user_id_user_id_fk" FOREIGN KEY ("banned_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_bans" ADD CONSTRAINT "community_bans_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_bans" ADD CONSTRAINT "community_bans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "communities_genre_id_idx" ON "communities" USING btree ("genre_id");--> statement-breakpoint
CREATE UNIQUE INDEX "community_bans_community_user_idx" ON "community_bans" USING btree ("community_id","user_id");--> statement-breakpoint
DROP INDEX IF EXISTS "community_messages_community_id_idx";--> statement-breakpoint
CREATE INDEX "community_messages_community_created_idx" ON "community_messages" USING btree ("community_id","created_at");
