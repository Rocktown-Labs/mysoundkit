CREATE TYPE "public"."battle_kit_track_role" AS ENUM('main', 'tiebreaker');--> statement-breakpoint
CREATE TYPE "public"."open_verse_access_mode" AS ENUM('open', 'approval_required');--> statement-breakpoint
CREATE TYPE "public"."open_verse_access_request_status" AS ENUM('pending', 'approved', 'declined', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."presence_status" AS ENUM('online', 'away', 'offline');--> statement-breakpoint
ALTER TYPE "public"."track_asset_kind" ADD VALUE 'open_verse_clip';--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"display_name" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"mime_type" text,
	"object_key" text,
	"size_bytes" integer,
	"source_project_id" text,
	"source_track_id" text,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_verse_access_requests" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"message" text,
	"requester_user_id" text NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by_user_id" text,
	"status" "open_verse_access_request_status" DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_pre_saves" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "project_pre_saves_user_id_project_id_pk" PRIMARY KEY("user_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"follower_user_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	CONSTRAINT "user_follows_follower_user_id_target_user_id_pk" PRIMARY KEY("follower_user_id","target_user_id")
);
--> statement-breakpoint
CREATE TABLE "user_presence" (
	"last_seen" timestamp NOT NULL,
	"status" "presence_status" DEFAULT 'offline' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_pre_saves" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"video_id" text NOT NULL,
	CONSTRAINT "video_pre_saves_user_id_video_id_pk" PRIMARY KEY("user_id","video_id")
);
--> statement-breakpoint
ALTER TABLE "listening_parties" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ALTER COLUMN "downloads_require_first_play" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "tracks" ALTER COLUMN "downloads_require_purchase" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "battle_kit_tracks" ADD COLUMN "main_slot" integer;--> statement-breakpoint
ALTER TABLE "battle_kit_tracks" ADD COLUMN "role" "battle_kit_track_role" DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "battle_kits" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "battle_kits" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "listening_parties" ADD COLUMN "genre_id" text;--> statement-breakpoint
ALTER TABLE "listening_parties" ADD COLUMN "playlist_id" text;--> statement-breakpoint
ALTER TABLE "live_experiences" ADD COLUMN "genre" text;--> statement-breakpoint
ALTER TABLE "open_verse_listings" ADD COLUMN "access_mode" "open_verse_access_mode" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "open_verse_listings" ADD COLUMN "preview_asset_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "genre_id" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "media_layout" text DEFAULT 'cards' NOT NULL;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_source_project_id_projects_id_fk" FOREIGN KEY ("source_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_source_track_id_tracks_id_fk" FOREIGN KEY ("source_track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_verse_access_requests" ADD CONSTRAINT "open_verse_access_requests_listing_id_open_verse_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."open_verse_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_verse_access_requests" ADD CONSTRAINT "open_verse_access_requests_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_verse_access_requests" ADD CONSTRAINT "open_verse_access_requests_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_pre_saves" ADD CONSTRAINT "project_pre_saves_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_pre_saves" ADD CONSTRAINT "project_pre_saves_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_user_id_user_id_fk" FOREIGN KEY ("follower_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_pre_saves" ADD CONSTRAINT "video_pre_saves_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_pre_saves" ADD CONSTRAINT "video_pre_saves_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_attachments_message_id_idx" ON "message_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "open_verse_access_requests_listing_id_idx" ON "open_verse_access_requests" USING btree ("listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "open_verse_access_requests_listing_requester_idx" ON "open_verse_access_requests" USING btree ("listing_id","requester_user_id");--> statement-breakpoint
CREATE INDEX "user_presence_last_seen_idx" ON "user_presence" USING btree ("last_seen");--> statement-breakpoint
ALTER TABLE "battle_kits" ADD CONSTRAINT "battle_kits_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listening_parties" ADD CONSTRAINT "listening_parties_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_experiences" ADD CONSTRAINT "live_experiences_battle_kit_id_battle_kits_id_fk" FOREIGN KEY ("battle_kit_id") REFERENCES "public"."battle_kits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_verse_listings" ADD CONSTRAINT "open_verse_listings_preview_asset_id_track_assets_id_fk" FOREIGN KEY ("preview_asset_id") REFERENCES "public"."track_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "battle_kit_tracks_kit_track_idx" ON "battle_kit_tracks" USING btree ("battle_kit_id","track_id");--> statement-breakpoint
CREATE INDEX "battle_kits_owner_user_id_idx" ON "battle_kits" USING btree ("owner_user_id");