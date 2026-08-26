CREATE TABLE "video_view_sessions" (
	"city" text,
	"country_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"duration_seconds" integer,
	"ended_at" timestamp,
	"id" text PRIMARY KEY NOT NULL,
	"last_heartbeat_at" timestamp,
	"region_code" text,
	"region_name" text,
	"session_token_hash" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"status" "playback_session_status" DEFAULT 'started' NOT NULL,
	"video_id" text NOT NULL,
	"viewer_key" text NOT NULL,
	"viewer_user_id" text,
	"watched_seconds" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_view_sessions" ADD CONSTRAINT "video_view_sessions_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_view_sessions" ADD CONSTRAINT "video_view_sessions_viewer_user_id_user_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_view_sessions_video_started_idx" ON "video_view_sessions" USING btree ("video_id","started_at");--> statement-breakpoint
CREATE INDEX "video_view_sessions_video_viewer_idx" ON "video_view_sessions" USING btree ("video_id","viewer_key");--> statement-breakpoint
CREATE INDEX "video_view_sessions_video_location_idx" ON "video_view_sessions" USING btree ("video_id","country_code","region_code");