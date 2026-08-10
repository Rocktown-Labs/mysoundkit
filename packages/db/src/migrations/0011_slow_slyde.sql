ALTER TYPE "public"."project_type" ADD VALUE 'mixtape' BEFORE 'single';--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by_user_id" text,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_pre_saves" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"track_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "track_pre_saves_user_id_track_id_pk" PRIMARY KEY("user_id","track_id")
);
--> statement-breakpoint
CREATE TABLE "user_notifications" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"link" text,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_credit_grants" (
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"granted_by_user_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"reason" text,
	"source" text DEFAULT 'admin_grant' NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_ad_campaigns" ALTER COLUMN "status" SET DEFAULT 'pending_review';--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "pro_affiliation" text;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "pro_member_id" text;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "songwriter_legal_name" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "streaming_links" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "isrc" text;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "streaming_links" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "genre_id" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "release_at" timestamp;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_pre_saves" ADD CONSTRAINT "track_pre_saves_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_pre_saves" ADD CONSTRAINT "track_pre_saves_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_credit_grants" ADD CONSTRAINT "ai_credit_grants_granted_by_user_id_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_credit_grants" ADD CONSTRAINT "ai_credit_grants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_credit_grants_user_id_idx" ON "ai_credit_grants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_credit_grants_created_at_idx" ON "ai_credit_grants" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE set null ON UPDATE no action;