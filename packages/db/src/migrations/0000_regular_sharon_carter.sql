CREATE TYPE "public"."account_type" AS ENUM('artist', 'fan');--> statement-breakpoint
CREATE TYPE "public"."analytics_scope_type" AS ENUM('user', 'artist', 'workspace', 'track', 'video', 'battle');--> statement-breakpoint
CREATE TYPE "public"."artist_role" AS ENUM('musician', 'producer');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('pending', 'uploading', 'uploaded', 'processing', 'ready', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."asset_storage_provider" AS ENUM('r2', 'mux', 'external');--> statement-breakpoint
CREATE TYPE "public"."battle_challenge_status" AS ENUM('pending', 'accepted', 'declined', 'canceled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."battle_format" AS ENUM('best_of_3', 'best_of_5', 'best_of_7');--> statement-breakpoint
CREATE TYPE "public"."battle_round_status" AS ENUM('upcoming', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."battle_status" AS ENUM('scheduled', 'live', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."battle_visibility" AS ENUM('public', 'premium_only');--> statement-breakpoint
CREATE TYPE "public"."catalog_item_type" AS ENUM('single', 'beat', 'instrumental');--> statement-breakpoint
CREATE TYPE "public"."collaborator_role" AS ENUM('artist', 'producer', 'vocalist', 'engineer', 'songwriter', 'manager', 'social_media_manager', 'marketing', 'family_member');--> statement-breakpoint
CREATE TYPE "public"."conversation_type" AS ENUM('direct', 'group', 'battle_live');--> statement-breakpoint
CREATE TYPE "public"."app_invitation_status" AS ENUM('pending', 'accepted', 'rejected', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."listening_party_playback_mode" AS ENUM('artist_hosted', 'programmed_release');--> statement-breakpoint
CREATE TYPE "public"."listening_party_status" AS ENUM('scheduled', 'live', 'ended', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."lyrics_revision_status" AS ENUM('pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."lyrics_source_type" AS ENUM('artist', 'collaborator', 'machine_transcription', 'fan_submission', 'import');--> statement-breakpoint
CREATE TYPE "public"."lyrics_status" AS ENUM('missing', 'generating', 'pending_review', 'approved', 'failed');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('sent', 'delivered', 'read', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."open_verse_status" AS ENUM('open', 'closed', 'fulfilled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."open_verse_submission_status" AS ENUM('submitted', 'shortlisted', 'accepted', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'checkout_pending', 'paid', 'failed', 'refunded', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."post_kind" AS ENUM('track', 'project', 'video', 'battle_replay', 'media');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('track', 'project', 'video');--> statement-breakpoint
CREATE TYPE "public"."project_asset_kind" AS ENUM('cover_art', 'photo', 'video', 'attachment');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'scheduled', 'released', 'archived');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('album', 'ep', 'single');--> statement-breakpoint
CREATE TYPE "public"."purchase_mode" AS ENUM('digital_download', 'license');--> statement-breakpoint
CREATE TYPE "public"."release_strategy" AS ENUM('private', 'publish_when_ready', 'scheduled');--> statement-breakpoint
CREATE TYPE "public"."searchable_entity_type" AS ENUM('artist', 'track', 'project', 'video', 'lyrics');--> statement-breakpoint
CREATE TYPE "public"."seller_onboarding_status" AS ENUM('not_started', 'pending', 'restricted', 'enabled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."stem_job_status" AS ENUM('queued', 'submitted', 'processing', 'completed', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."stem_output_format" AS ENUM('MP3', 'WAV', 'FLAC');--> statement-breakpoint
CREATE TYPE "public"."stem_output_type" AS ENUM('VOCALS', 'INSTRUMENTAL', 'BOTH', 'FOUR_STEMS', 'SIX_STEMS');--> statement-breakpoint
CREATE TYPE "public"."track_asset_kind" AS ENUM('cover_art', 'master', 'vocal_stem', 'clean', 'alternate_mix', 'artwork', 'booklet', 'tagged_mp3', 'untagged_wav', 'stems', 'midi', 'license_pdf', 'instrumental', 'verse_vocal', 'adlib', 'session_file', 'reference_audio', 'variant_audio');--> statement-breakpoint
CREATE TYPE "public"."track_production_status" AS ENUM('demo', 'mixed', 'mastered', 'complete');--> statement-breakpoint
CREATE TYPE "public"."track_variant_type" AS ENUM('original', 'clean', 'dirty', 'acapella', 'instrumental', 'radio_edit');--> statement-breakpoint
CREATE TYPE "public"."video_kind" AS ENUM('music_video', 'promo', 'teaser', 'battle_replay', 'battle_clip', 'live_recording');--> statement-breakpoint
CREATE TYPE "public"."video_playback_policy" AS ENUM('public', 'signed');--> statement-breakpoint
CREATE TYPE "public"."video_source_provider" AS ENUM('mux', 'external');--> statement-breakpoint
CREATE TYPE "public"."webhook_provider" AS ENUM('stripe', 'mux', 'stemsplit', 'battle_service');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('received', 'processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."workflow_job_status" AS ENUM('queued', 'running', 'waiting', 'completed', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."workspace_type" AS ENUM('artist_team', 'fan_family');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_provider" AS ENUM('none', 'manual', 'printful');--> statement-breakpoint
CREATE TYPE "public"."community_member_role" AS ENUM('owner', 'moderator', 'member');--> statement-breakpoint
CREATE TYPE "public"."community_post_type" AS ENUM('text', 'image', 'audio', 'video', 'poll');--> statement-breakpoint
CREATE TYPE "public"."community_subscription_status" AS ENUM('pending', 'active', 'past_due', 'canceled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('product_purchase', 'tip', 'community_subscription', 'platform_subscription');--> statement-breakpoint
CREATE TABLE "analytics_daily_rollups" (
	"comments" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"date_key" text NOT NULL,
	"downloads" integer DEFAULT 0 NOT NULL,
	"followers" integer DEFAULT 0 NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"plays" integer DEFAULT 0 NOT NULL,
	"purchases" integer DEFAULT 0 NOT NULL,
	"revenue_cents" integer DEFAULT 0 NOT NULL,
	"scope_id" text NOT NULL,
	"scope_type" "analytics_scope_type" NOT NULL,
	"viewers" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_follows" (
	"artist_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"follower_user_id" text NOT NULL,
	CONSTRAINT "artist_follows_follower_user_id_artist_user_id_pk" PRIMARY KEY("follower_user_id","artist_user_id")
);
--> statement-breakpoint
CREATE TABLE "artist_profile_roles" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"role" "artist_role" NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "artist_profile_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "artist_profiles" (
	"allow_direct_messages" boolean DEFAULT true NOT NULL,
	"battle_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"hometown" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"primary_genre_id" text,
	"primary_organization_id" text,
	"project_count" integer DEFAULT 0 NOT NULL,
	"public_profile_enabled" boolean DEFAULT true NOT NULL,
	"stage_name" text,
	"track_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battle_challenges" (
	"challenger_organization_id" text,
	"challenger_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"format" "battle_format" NOT NULL,
	"genre_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"message" text,
	"opponent_artist_user_id" text,
	"opponent_username_snapshot" text,
	"proposed_date" timestamp,
	"proposed_time_label" text,
	"status" "battle_challenge_status" DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battle_kit_tracks" (
	"battle_kit_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"seed_order" integer DEFAULT 0 NOT NULL,
	"track_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battle_kits" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"format" "battle_format" NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battle_profiles" (
	"total_downloads" integer DEFAULT 0 NOT NULL,
	"total_losses" integer DEFAULT 0 NOT NULL,
	"total_purchases" integer DEFAULT 0 NOT NULL,
	"total_saves" integer DEFAULT 0 NOT NULL,
	"total_votes_received" integer DEFAULT 0 NOT NULL,
	"total_wins" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battle_rounds" (
	"battle_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"is_tiebreaker" boolean DEFAULT false NOT NULL,
	"round_number" integer NOT NULL,
	"status" "battle_round_status" DEFAULT 'upcoming' NOT NULL,
	"track_one_id" text,
	"track_one_votes" integer DEFAULT 0 NOT NULL,
	"track_two_id" text,
	"track_two_votes" integer DEFAULT 0 NOT NULL,
	"voting_ends_at" timestamp,
	"winning_track_id" text
);
--> statement-breakpoint
CREATE TABLE "battle_stats" (
	"downloads" integer DEFAULT 0 NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"purchases" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"track_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battles" (
	"challenger_artist_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"external_battle_id" text,
	"format" "battle_format" NOT NULL,
	"genre_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"opponent_artist_user_id" text,
	"replay_video_id" text,
	"starts_at" timestamp,
	"status" "battle_status" DEFAULT 'scheduled' NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"viewer_count" integer DEFAULT 0 NOT NULL,
	"visibility" "battle_visibility" DEFAULT 'public' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"cart_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"license_option_id" text,
	"price_cents_snapshot" integer NOT NULL,
	"product_type" "product_type" NOT NULL,
	"project_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"seller_user_id" text,
	"title_snapshot" text NOT NULL,
	"track_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"conversation_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"last_read_at" timestamp,
	"user_id" text NOT NULL,
	CONSTRAINT "conversation_participants_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"conversation_type" "conversation_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"title" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fan_profiles" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"favorite_artist_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "genres" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_saves" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"track_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "library_saves_user_id_track_id_pk" PRIMARY KEY("user_id","track_id")
);
--> statement-breakpoint
CREATE TABLE "listening_parties" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"ended_at" timestamp,
	"host_user_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"live_room_id" text,
	"live_video_provider" text DEFAULT 'mux' NOT NULL,
	"organization_id" text,
	"playback_mode" "listening_party_playback_mode" DEFAULT 'artist_hosted' NOT NULL,
	"project_id" text NOT NULL,
	"scheduled_start_at" timestamp NOT NULL,
	"started_at" timestamp,
	"status" "listening_party_status" DEFAULT 'scheduled' NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"body" text NOT NULL,
	"conversation_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"sender_user_id" text NOT NULL,
	"status" "message_status" DEFAULT 'sent' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mux_assets" (
	"aspect_ratio" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"duration_seconds" numeric,
	"live_stream_id" text,
	"mux_asset_id" text PRIMARY KEY NOT NULL,
	"mux_upload_id" text,
	"passthrough" text,
	"playback_ids" jsonb,
	"resolution_tier" text,
	"status" text DEFAULT 'preparing' NOT NULL,
	"tracks" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"video_id" text,
	"video_quality" text
);
--> statement-breakpoint
CREATE TABLE "mux_uploads" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"mux_asset_id" text,
	"mux_upload_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"timeout_seconds" integer DEFAULT 3600 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"video_id" text
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"email_collaborations" boolean DEFAULT true NOT NULL,
	"email_comments" boolean DEFAULT true NOT NULL,
	"email_followers" boolean DEFAULT true NOT NULL,
	"email_sales" boolean DEFAULT true NOT NULL,
	"push_mentions" boolean DEFAULT true NOT NULL,
	"push_messages" boolean DEFAULT true NOT NULL,
	"push_releases" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_verse_listings" (
	"bpm" integer,
	"closes_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"genre_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"max_submissions" integer DEFAULT 50 NOT NULL,
	"musical_key" text,
	"organization_id" text,
	"owner_user_id" text NOT NULL,
	"slot_ends_at_ms" integer,
	"slot_starts_at_ms" integer,
	"status" "open_verse_status" DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"track_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_verse_submissions" (
	"asset_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"message" text,
	"status" "open_verse_submission_status" DEFAULT 'submitted' NOT NULL,
	"submitter_user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"license_option_id" text,
	"order_id" text NOT NULL,
	"price_snapshot" numeric(10, 2) NOT NULL,
	"product_type" "product_type" NOT NULL,
	"project_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"title_snapshot" text NOT NULL,
	"track_id" text,
	"video_id" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"buyer_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"seller_user_id" text,
	"status" "order_status" DEFAULT 'draft' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"subtotal" numeric(10, 2),
	"total" numeric(10, 2),
	"total_cents" integer,
	"transaction_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"settled_at" timestamp,
	"status" text NOT NULL,
	"stripe_payout_id" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_catalog" (
	"ads_enabled" boolean DEFAULT true NOT NULL,
	"audience" "account_type" NOT NULL,
	"can_view_live_battles" boolean DEFAULT false NOT NULL,
	"can_vote_live_battles" boolean DEFAULT false NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"feature_limits" jsonb,
	"id" text PRIMARY KEY NOT NULL,
	"max_seats" integer,
	"monthly_price" numeric(10, 2) NOT NULL,
	"name" text NOT NULL,
	"stripe_annual_price_id" text,
	"stripe_monthly_price_id" text,
	"supports_workspace_seats" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist_tracks" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"playlist_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"track_id" text NOT NULL,
	CONSTRAINT "playlist_tracks_playlist_id_track_id_pk" PRIMARY KEY("playlist_id","track_id")
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"owner_user_id" text NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_comments" (
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"parent_comment_id" text,
	"post_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_likes" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "post_likes_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"caption" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"post_kind" "post_kind" NOT NULL,
	"project_id" text,
	"track_id" text,
	"video_id" text
);
--> statement-breakpoint
CREATE TABLE "privacy_settings" (
	"allow_messages" boolean DEFAULT true NOT NULL,
	"public_profile" boolean DEFAULT true NOT NULL,
	"show_followers" boolean DEFAULT true NOT NULL,
	"show_location" boolean DEFAULT true NOT NULL,
	"show_track_count" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_links" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"handle" text,
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"url" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_assets" (
	"asset_kind" "project_asset_kind" NOT NULL,
	"bucket_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"mime_type" text,
	"mux_asset_id" text,
	"mux_playback_id" text,
	"mux_upload_id" text,
	"object_key" text,
	"project_id" text NOT NULL,
	"size_bytes" integer,
	"status" "asset_status" DEFAULT 'pending' NOT NULL,
	"storage_provider" "asset_storage_provider" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"uploader_user_id" text
);
--> statement-breakpoint
CREATE TABLE "project_collaborators" (
	"can_delete" boolean DEFAULT false NOT NULL,
	"can_edit" boolean DEFAULT true NOT NULL,
	"can_upload" boolean DEFAULT true NOT NULL,
	"collaborator_role" "collaborator_role" NOT NULL,
	"collaborator_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"invitation_status" "app_invitation_status" DEFAULT 'pending' NOT NULL,
	"invite_email" text,
	"invited_by_user_id" text,
	"project_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tracks" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"project_id" text NOT NULL,
	"track_id" text NOT NULL,
	CONSTRAINT "project_tracks_project_id_track_id_pk" PRIMARY KEY("project_id","track_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_for_sale" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"organization_id" text,
	"owner_user_id" text NOT NULL,
	"price_cents" integer,
	"project_type" "project_type" NOT NULL,
	"purchase_mode" "purchase_mode" DEFAULT 'digital_download' NOT NULL,
	"release_date" timestamp,
	"slug" text NOT NULL,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"buyer_user_id" text NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"last_downloaded_at" timestamp,
	"order_item_id" text NOT NULL,
	"project_id" text,
	"purchased_at" timestamp DEFAULT now() NOT NULL,
	"track_id" text,
	"video_id" text
);
--> statement-breakpoint
CREATE TABLE "recent_plays" (
	"id" text PRIMARY KEY NOT NULL,
	"last_played_at" timestamp DEFAULT now() NOT NULL,
	"play_count" integer DEFAULT 1 NOT NULL,
	"track_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_embeddings" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"dimensions" integer DEFAULT 1536 NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"entity_id" text NOT NULL,
	"entity_type" "searchable_entity_type" NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"indexed_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"model" text NOT NULL,
	"organization_id" text,
	"text_hash" text NOT NULL,
	"text_snapshot" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_accounts" (
	"charges_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"details_submitted" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"onboarding_status" "seller_onboarding_status" DEFAULT 'not_started' NOT NULL,
	"organization_id" text,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"requirements_due" jsonb,
	"stripe_account_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_entitlements" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"entitlement_key" text NOT NULL,
	"entitlement_value" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_assets" (
	"asset_kind" "track_asset_kind" NOT NULL,
	"bucket_name" text,
	"checksum" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"duration_ms" integer,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"mime_type" text,
	"object_key" text,
	"size_bytes" integer,
	"status" "asset_status" DEFAULT 'pending' NOT NULL,
	"storage_provider" "asset_storage_provider" NOT NULL,
	"track_id" text NOT NULL,
	"track_variant_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"uploader_user_id" text
);
--> statement-breakpoint
CREATE TABLE "track_collaborators" (
	"can_delete" boolean DEFAULT false NOT NULL,
	"can_edit" boolean DEFAULT true NOT NULL,
	"can_upload" boolean DEFAULT true NOT NULL,
	"collaborator_role" "collaborator_role" NOT NULL,
	"collaborator_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"invitation_status" "app_invitation_status" DEFAULT 'pending' NOT NULL,
	"invite_email" text,
	"invited_by_user_id" text,
	"track_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_license_options" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"includes_stems" boolean DEFAULT false NOT NULL,
	"is_exclusive" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"rights_summary" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"track_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_lyrics" (
	"approved_at" timestamp,
	"approved_by_user_id" text,
	"contributor_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"language" text,
	"metadata" jsonb,
	"source_asset_id" text,
	"source_type" "lyrics_source_type" DEFAULT 'import' NOT NULL,
	"status" "lyrics_revision_status" DEFAULT 'pending_review' NOT NULL,
	"text" text NOT NULL,
	"timed_lines" jsonb,
	"track_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_stem_jobs" (
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"credits_charged" integer,
	"credits_required" integer,
	"error" jsonb,
	"id" text PRIMARY KEY NOT NULL,
	"input_asset_id" text NOT NULL,
	"output_format" "stem_output_format" DEFAULT 'MP3' NOT NULL,
	"output_type" "stem_output_type" DEFAULT 'BOTH' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"source_url_expires_at" timestamp,
	"status" "stem_job_status" DEFAULT 'queued' NOT NULL,
	"stemsplit_job_id" text,
	"track_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"workflow_instance_id" text
);
--> statement-breakpoint
CREATE TABLE "track_variants" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"track_id" text NOT NULL,
	"variant_type" "track_variant_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"bpm" integer,
	"catalog_item_type" "catalog_item_type" DEFAULT 'single' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text,
	"genre_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_for_sale" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"lyrics_status" "lyrics_status" DEFAULT 'missing' NOT NULL,
	"musical_key" text,
	"organization_id" text,
	"owner_user_id" text NOT NULL,
	"price" numeric(10, 2),
	"price_cents" integer,
	"production_status" "track_production_status" DEFAULT 'demo' NOT NULL,
	"published_at" timestamp,
	"purchase_mode" "purchase_mode" DEFAULT 'digital_download' NOT NULL,
	"release_at" timestamp,
	"release_strategy" "release_strategy" DEFAULT 'private' NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_genre_preferences" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"genre_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "user_genre_preferences_user_id_genre_id_pk" PRIMARY KEY("user_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"account_type" "account_type" NOT NULL,
	"avatar_object_key" text,
	"avatar_url" text,
	"bio" text,
	"city" text,
	"country" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"display_name" text,
	"header_object_key" text,
	"header_url" text,
	"onboarding_completed_at" timestamp,
	"state" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"duration_ms" integer,
	"external_playback_url" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"mux_asset_id" text,
	"mux_passthrough" text,
	"mux_playback_id" text,
	"mux_upload_id" text,
	"organization_id" text,
	"owner_user_id" text NOT NULL,
	"playback_policy" "video_playback_policy" DEFAULT 'public' NOT NULL,
	"published_at" timestamp,
	"source_project_id" text,
	"source_provider" "video_source_provider" DEFAULT 'mux' NOT NULL,
	"source_track_id" text,
	"status" "asset_status" DEFAULT 'pending' NOT NULL,
	"thumbnail_url" text,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"verified_on_platform" boolean DEFAULT false NOT NULL,
	"video_kind" "video_kind" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"event_type" text NOT NULL,
	"external_event_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp,
	"provider" "webhook_provider" NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"status" "webhook_status" DEFAULT 'received' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_jobs" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"error" jsonb,
	"finished_at" timestamp,
	"id" text PRIMARY KEY NOT NULL,
	"input" jsonb,
	"job_type" text NOT NULL,
	"output" jsonb,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"status" "workflow_job_status" DEFAULT 'queued' NOT NULL,
	"target_id" text NOT NULL,
	"target_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_profiles" (
	"ads_enabled" boolean DEFAULT true NOT NULL,
	"billing_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" text PRIMARY KEY NOT NULL,
	"premium_playback_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"workspace_type" "workspace_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"access_token" text,
	"access_token_expires_at" timestamp,
	"account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"id_token" text,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"updated_at" timestamp NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"inviter_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"team_id" text
);
--> statement-breakpoint
CREATE TABLE "member" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"logo" text,
	"metadata" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"stripe_customer_id" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"active_organization_id" text,
	"active_team_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"ip_address" text,
	"token" text NOT NULL,
	"updated_at" timestamp NOT NULL,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"billing_interval" text,
	"cancel_at" timestamp,
	"cancel_at_period_end" boolean,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"id" text PRIMARY KEY NOT NULL,
	"period_end" timestamp,
	"period_start" timestamp,
	"plan" text NOT NULL,
	"reference_id" text NOT NULL,
	"seats" integer,
	"status" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_schedule_id" text,
	"stripe_subscription_id" text,
	"trial_end" timestamp,
	"trial_start" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"name" text NOT NULL,
	"stripe_customer_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellable_products" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text,
	"fulfillment_provider" "fulfillment_provider",
	"fulfillment_provider_reference" text,
	"id" text PRIMARY KEY NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"inventory_quantity" integer,
	"metadata" jsonb,
	"name" text NOT NULL,
	"organization_id" text,
	"owner_user_id" text NOT NULL,
	"price_cents" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communities" (
	"artist_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"monthly_price_cents" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"stripe_price_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_members" (
	"community_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"role" "community_member_role" DEFAULT 'member' NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_messages" (
	"body" text NOT NULL,
	"community_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_posts" (
	"body" text,
	"community_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"media_url" text,
	"metadata" jsonb,
	"post_type" "community_post_type" DEFAULT 'text' NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_subscriptions" (
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"community_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"current_period_end" timestamp,
	"id" text PRIMARY KEY NOT NULL,
	"status" "community_subscription_status" DEFAULT 'pending' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_refunds" (
	"amount_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"reason" text,
	"stripe_refund_id" text NOT NULL,
	"transaction_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_records" (
	"amount_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"seller_user_id" text,
	"status" text NOT NULL,
	"stripe_payout_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_fees" (
	"amount_cents" integer NOT NULL,
	"basis_points" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"event_type" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp,
	"status" text DEFAULT 'received' NOT NULL,
	"stripe_event_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tips" (
	"amount_cents" integer NOT NULL,
	"artist_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"fan_user_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"message" text,
	"transaction_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"amount_cents" integer NOT NULL,
	"artist_amount_cents" integer NOT NULL,
	"buyer_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"platform_fee_cents" integer NOT NULL,
	"seller_user_id" text,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_subscription_id" text,
	"transaction_type" "transaction_type" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_catalog_v2" (
	"annual_price_cents" integer,
	"audience" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"entitlements" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_seats" integer,
	"monthly_price_cents" integer NOT NULL,
	"name" text NOT NULL,
	"stripe_annual_price_id" text,
	"stripe_monthly_price_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_entitlements_v2" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"entitlement_key" text NOT NULL,
	"entitlement_value" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artist_follows" ADD CONSTRAINT "artist_follows_artist_user_id_user_id_fk" FOREIGN KEY ("artist_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_follows" ADD CONSTRAINT "artist_follows_follower_user_id_user_id_fk" FOREIGN KEY ("follower_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_profile_roles" ADD CONSTRAINT "artist_profile_roles_user_id_artist_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."artist_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD CONSTRAINT "artist_profiles_primary_genre_id_genres_id_fk" FOREIGN KEY ("primary_genre_id") REFERENCES "public"."genres"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD CONSTRAINT "artist_profiles_primary_organization_id_organization_id_fk" FOREIGN KEY ("primary_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD CONSTRAINT "artist_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_challenges" ADD CONSTRAINT "battle_challenges_challenger_organization_id_organization_id_fk" FOREIGN KEY ("challenger_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_challenges" ADD CONSTRAINT "battle_challenges_challenger_user_id_user_id_fk" FOREIGN KEY ("challenger_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_challenges" ADD CONSTRAINT "battle_challenges_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_challenges" ADD CONSTRAINT "battle_challenges_opponent_artist_user_id_user_id_fk" FOREIGN KEY ("opponent_artist_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_kit_tracks" ADD CONSTRAINT "battle_kit_tracks_battle_kit_id_battle_kits_id_fk" FOREIGN KEY ("battle_kit_id") REFERENCES "public"."battle_kits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_kit_tracks" ADD CONSTRAINT "battle_kit_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_kits" ADD CONSTRAINT "battle_kits_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_profiles" ADD CONSTRAINT "battle_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_rounds" ADD CONSTRAINT "battle_rounds_battle_id_battles_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_rounds" ADD CONSTRAINT "battle_rounds_track_one_id_tracks_id_fk" FOREIGN KEY ("track_one_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_rounds" ADD CONSTRAINT "battle_rounds_track_two_id_tracks_id_fk" FOREIGN KEY ("track_two_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_rounds" ADD CONSTRAINT "battle_rounds_winning_track_id_tracks_id_fk" FOREIGN KEY ("winning_track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_stats" ADD CONSTRAINT "battle_stats_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_stats" ADD CONSTRAINT "battle_stats_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_challenger_artist_user_id_user_id_fk" FOREIGN KEY ("challenger_artist_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_opponent_artist_user_id_user_id_fk" FOREIGN KEY ("opponent_artist_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_replay_video_id_videos_id_fk" FOREIGN KEY ("replay_video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_license_option_id_track_license_options_id_fk" FOREIGN KEY ("license_option_id") REFERENCES "public"."track_license_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_seller_user_id_user_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_profiles" ADD CONSTRAINT "fan_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_saves" ADD CONSTRAINT "library_saves_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_saves" ADD CONSTRAINT "library_saves_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listening_parties" ADD CONSTRAINT "listening_parties_host_user_id_user_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listening_parties" ADD CONSTRAINT "listening_parties_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listening_parties" ADD CONSTRAINT "listening_parties_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mux_assets" ADD CONSTRAINT "mux_assets_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mux_uploads" ADD CONSTRAINT "mux_uploads_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_verse_listings" ADD CONSTRAINT "open_verse_listings_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_verse_listings" ADD CONSTRAINT "open_verse_listings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_verse_listings" ADD CONSTRAINT "open_verse_listings_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_verse_listings" ADD CONSTRAINT "open_verse_listings_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_verse_submissions" ADD CONSTRAINT "open_verse_submissions_asset_id_track_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."track_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_verse_submissions" ADD CONSTRAINT "open_verse_submissions_listing_id_open_verse_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."open_verse_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_verse_submissions" ADD CONSTRAINT "open_verse_submissions_submitter_user_id_user_id_fk" FOREIGN KEY ("submitter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_license_option_id_track_license_options_id_fk" FOREIGN KEY ("license_option_id") REFERENCES "public"."track_license_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_user_id_user_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_user_id_user_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_settings" ADD CONSTRAINT "privacy_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_links" ADD CONSTRAINT "profile_links_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_uploader_user_id_user_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_collaborators" ADD CONSTRAINT "project_collaborators_collaborator_user_id_user_id_fk" FOREIGN KEY ("collaborator_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_collaborators" ADD CONSTRAINT "project_collaborators_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_collaborators" ADD CONSTRAINT "project_collaborators_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tracks" ADD CONSTRAINT "project_tracks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tracks" ADD CONSTRAINT "project_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_buyer_user_id_user_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recent_plays" ADD CONSTRAINT "recent_plays_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recent_plays" ADD CONSTRAINT "recent_plays_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_embeddings" ADD CONSTRAINT "search_embeddings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_accounts" ADD CONSTRAINT "seller_accounts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_accounts" ADD CONSTRAINT "seller_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "subscription_entitlements_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_assets" ADD CONSTRAINT "track_assets_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_assets" ADD CONSTRAINT "track_assets_track_variant_id_track_variants_id_fk" FOREIGN KEY ("track_variant_id") REFERENCES "public"."track_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_assets" ADD CONSTRAINT "track_assets_uploader_user_id_user_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_collaborators" ADD CONSTRAINT "track_collaborators_collaborator_user_id_user_id_fk" FOREIGN KEY ("collaborator_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_collaborators" ADD CONSTRAINT "track_collaborators_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_collaborators" ADD CONSTRAINT "track_collaborators_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_license_options" ADD CONSTRAINT "track_license_options_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_lyrics" ADD CONSTRAINT "track_lyrics_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_lyrics" ADD CONSTRAINT "track_lyrics_contributor_user_id_user_id_fk" FOREIGN KEY ("contributor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_lyrics" ADD CONSTRAINT "track_lyrics_source_asset_id_track_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."track_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_lyrics" ADD CONSTRAINT "track_lyrics_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_stem_jobs" ADD CONSTRAINT "track_stem_jobs_input_asset_id_track_assets_id_fk" FOREIGN KEY ("input_asset_id") REFERENCES "public"."track_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_stem_jobs" ADD CONSTRAINT "track_stem_jobs_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_variants" ADD CONSTRAINT "track_variants_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_genre_preferences" ADD CONSTRAINT "user_genre_preferences_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_genre_preferences" ADD CONSTRAINT "user_genre_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_source_project_id_projects_id_fk" FOREIGN KEY ("source_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_source_track_id_tracks_id_fk" FOREIGN KEY ("source_track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_profiles" ADD CONSTRAINT "workspace_profiles_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellable_products" ADD CONSTRAINT "sellable_products_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellable_products" ADD CONSTRAINT "sellable_products_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_artist_user_id_user_id_fk" FOREIGN KEY ("artist_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_subscriptions" ADD CONSTRAINT "community_subscriptions_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_subscriptions" ADD CONSTRAINT "community_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_records" ADD CONSTRAINT "payout_records_seller_user_id_user_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_fees" ADD CONSTRAINT "platform_fees_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_artist_user_id_user_id_fk" FOREIGN KEY ("artist_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_fan_user_id_user_id_fk" FOREIGN KEY ("fan_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_buyer_user_id_user_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_seller_user_id_user_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_entitlements_v2" ADD CONSTRAINT "subscription_entitlements_v2_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_daily_rollups_scope_idx" ON "analytics_daily_rollups" USING btree ("scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "artist_profiles_primary_org_idx" ON "artist_profiles" USING btree ("primary_organization_id");--> statement-breakpoint
CREATE INDEX "battle_challenges_challenger_user_id_idx" ON "battle_challenges" USING btree ("challenger_user_id");--> statement-breakpoint
CREATE INDEX "battle_kit_tracks_battle_kit_id_idx" ON "battle_kit_tracks" USING btree ("battle_kit_id");--> statement-breakpoint
CREATE INDEX "battle_kits_organization_id_idx" ON "battle_kits" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "battle_rounds_battle_id_idx" ON "battle_rounds" USING btree ("battle_id");--> statement-breakpoint
CREATE INDEX "battle_stats_user_id_idx" ON "battle_stats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "battles_external_battle_id_idx" ON "battles" USING btree ("external_battle_id");--> statement-breakpoint
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "cart_items_track_id_idx" ON "cart_items" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "cart_items_project_id_idx" ON "cart_items" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_user_id_idx" ON "carts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_organization_id_idx" ON "conversations" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "genres_slug_idx" ON "genres" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "listening_parties_project_id_idx" ON "listening_parties" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "listening_parties_status_start_idx" ON "listening_parties" USING btree ("status","scheduled_start_at");--> statement-breakpoint
CREATE INDEX "listening_parties_host_user_id_idx" ON "listening_parties" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "mux_assets_status_idx" ON "mux_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mux_assets_upload_id_idx" ON "mux_assets" USING btree ("mux_upload_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mux_assets_video_id_idx" ON "mux_assets" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "mux_uploads_status_idx" ON "mux_uploads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mux_uploads_asset_id_idx" ON "mux_uploads" USING btree ("mux_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mux_uploads_video_id_idx" ON "mux_uploads" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "open_verse_listings_track_id_idx" ON "open_verse_listings" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "open_verse_listings_owner_user_id_idx" ON "open_verse_listings" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "open_verse_listings_status_genre_idx" ON "open_verse_listings" USING btree ("status","genre_id","created_at");--> statement-breakpoint
CREATE INDEX "open_verse_submissions_listing_id_idx" ON "open_verse_submissions" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "open_verse_submissions_submitter_user_id_idx" ON "open_verse_submissions" USING btree ("submitter_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "open_verse_submissions_listing_submitter_idx" ON "open_verse_submissions" USING btree ("listing_id","submitter_user_id");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_buyer_user_id_idx" ON "orders" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_transaction_id_idx" ON "orders" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "payouts_user_id_idx" ON "payouts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_catalog_code_idx" ON "plan_catalog" USING btree ("code");--> statement-breakpoint
CREATE INDEX "playlists_owner_user_id_idx" ON "playlists" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "post_comments_post_id_idx" ON "post_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "posts_owner_user_id_idx" ON "posts" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "profile_links_user_id_idx" ON "profile_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_assets_project_id_idx" ON "project_assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_collaborators_project_id_idx" ON "project_collaborators" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_idx" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "projects_owner_user_id_idx" ON "projects" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "purchases_buyer_user_id_idx" ON "purchases" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_order_item_id_idx" ON "purchases" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "recent_plays_user_id_idx" ON "recent_plays" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "search_embeddings_entity_idx" ON "search_embeddings" USING btree ("entity_type","entity_id","model");--> statement-breakpoint
CREATE INDEX "search_embeddings_organization_id_idx" ON "search_embeddings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_accounts_stripe_account_id_idx" ON "seller_accounts" USING btree ("stripe_account_id");--> statement-breakpoint
CREATE INDEX "seller_accounts_user_id_idx" ON "seller_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "seller_accounts_organization_id_idx" ON "seller_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "subscription_entitlements_subscription_id_idx" ON "subscription_entitlements" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "track_assets_track_id_idx" ON "track_assets" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_assets_variant_id_idx" ON "track_assets" USING btree ("track_variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "track_assets_storage_object_idx" ON "track_assets" USING btree ("storage_provider","object_key");--> statement-breakpoint
CREATE INDEX "track_collaborators_track_id_idx" ON "track_collaborators" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_license_options_track_id_idx" ON "track_license_options" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_lyrics_track_id_idx" ON "track_lyrics" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_lyrics_track_status_idx" ON "track_lyrics" USING btree ("track_id","status");--> statement-breakpoint
CREATE INDEX "track_stem_jobs_track_id_idx" ON "track_stem_jobs" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_stem_jobs_input_asset_id_idx" ON "track_stem_jobs" USING btree ("input_asset_id");--> statement-breakpoint
CREATE INDEX "track_stem_jobs_stemsplit_job_id_idx" ON "track_stem_jobs" USING btree ("stemsplit_job_id");--> statement-breakpoint
CREATE INDEX "track_variants_track_id_idx" ON "track_variants" USING btree ("track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_slug_idx" ON "tracks" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tracks_owner_user_id_idx" ON "tracks" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "tracks_organization_id_idx" ON "tracks" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_username_idx" ON "user_profiles" USING btree ("username");--> statement-breakpoint
CREATE INDEX "videos_owner_user_id_idx" ON "videos" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "webhook_events_provider_idx" ON "webhook_events" USING btree ("provider","event_type");--> statement-breakpoint
CREATE INDEX "workflow_jobs_target_idx" ON "workflow_jobs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organization_id_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organization_id_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_user_id_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_slug_idx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_reference_id_idx" ON "subscription" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX "team_organization_id_idx" ON "team" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "team_member_team_id_idx" ON "team_member" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_member_user_id_idx" ON "team_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "sellable_products_owner_user_id_idx" ON "sellable_products" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "sellable_products_fulfillment_provider_idx" ON "sellable_products" USING btree ("fulfillment_provider");--> statement-breakpoint
CREATE UNIQUE INDEX "communities_artist_user_id_idx" ON "communities" USING btree ("artist_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "communities_slug_idx" ON "communities" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "community_members_community_user_idx" ON "community_members" USING btree ("community_id","user_id");--> statement-breakpoint
CREATE INDEX "community_messages_community_id_idx" ON "community_messages" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "community_posts_community_id_idx" ON "community_posts" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "community_subscriptions_community_id_idx" ON "community_subscriptions" USING btree ("community_id");--> statement-breakpoint
CREATE UNIQUE INDEX "community_subscriptions_stripe_subscription_id_idx" ON "community_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_refunds_stripe_refund_id_idx" ON "payment_refunds" USING btree ("stripe_refund_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_records_stripe_payout_id_idx" ON "payout_records" USING btree ("stripe_payout_id");--> statement-breakpoint
CREATE INDEX "payout_records_seller_user_id_idx" ON "payout_records" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX "platform_fees_transaction_id_idx" ON "platform_fees" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_webhook_events_stripe_event_id_idx" ON "stripe_webhook_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "tips_artist_user_id_idx" ON "tips" USING btree ("artist_user_id");--> statement-breakpoint
CREATE INDEX "transactions_buyer_user_id_idx" ON "transactions" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "transactions_seller_user_id_idx" ON "transactions" USING btree ("seller_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_stripe_checkout_session_id_idx" ON "transactions" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_catalog_v2_code_idx" ON "plan_catalog_v2" USING btree ("code");--> statement-breakpoint
CREATE INDEX "subscription_entitlements_v2_subscription_id_idx" ON "subscription_entitlements_v2" USING btree ("subscription_id");