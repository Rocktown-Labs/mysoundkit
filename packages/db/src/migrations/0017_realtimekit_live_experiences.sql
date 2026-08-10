CREATE TYPE "public"."live_experience_status" AS ENUM('scheduled', 'live', 'ended');--> statement-breakpoint
CREATE TYPE "public"."live_experience_kind" AS ENUM('battle', 'party', 'stream');--> statement-breakpoint
ALTER TYPE "public"."webhook_provider" ADD VALUE 'realtimekit';--> statement-breakpoint
CREATE TABLE "live_experiences" (
	"battle_id" text,
	"battle_kit_id" text,
	"chat_download_url" text,
	"chat_download_url_expiry" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	"ends_at" timestamp,
	"id" text PRIMARY KEY NOT NULL,
	"kind" "live_experience_kind" NOT NULL,
	"meeting_id" text NOT NULL,
	"peak_viewer_count" integer DEFAULT 0 NOT NULL,
	"playlist_id" text,
	"project_id" text,
	"recording_audio_url" text,
	"recording_expires_at" timestamp,
	"recording_id" text,
	"recording_status" text,
	"recording_url" text,
	"source" text DEFAULT 'browser' NOT NULL,
	"starts_at" timestamp NOT NULL,
	"status" "live_experience_status" DEFAULT 'scheduled' NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"viewer_count" integer DEFAULT 0 NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "live_experiences" ADD CONSTRAINT "live_experiences_battle_id_battles_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_experiences" ADD CONSTRAINT "live_experiences_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_experiences" ADD CONSTRAINT "live_experiences_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_experiences" ADD CONSTRAINT "live_experiences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "live_experiences_meeting_id_idx" ON "live_experiences" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "live_experiences_creator_idx" ON "live_experiences" USING btree ("created_by_user_id");
