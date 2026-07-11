CREATE TYPE "public"."accounting_period_status" AS ENUM('open', 'calculating', 'review', 'finalized', 'payable', 'paid', 'reopened', 'voided');--> statement-breakpoint
CREATE TYPE "public"."ad_impression_status" AS ENUM('requested', 'served', 'viewable', 'completed', 'invalid', 'credited');--> statement-breakpoint
CREATE TYPE "public"."ad_inventory_type" AS ENUM('video_overlay', 'video_bottom_carousel', 'video_preroll', 'video_postroll', 'sponsored_video');--> statement-breakpoint
CREATE TYPE "public"."creator_earning_status" AS ENUM('estimated', 'held', 'finalized', 'payable', 'paid', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."creator_earning_type" AS ENUM('premium_stream_reward', 'ad_supported_reward', 'live_reward', 'battle_bonus', 'purchase_revenue', 'tip', 'promotion_bonus', 'manual_adjustment', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."fan_value_event_type" AS ENUM('qualified_stream', 'repeat_stream', 'track_save', 'playlist_add', 'artist_follow', 'battle_vote', 'live_attendance', 'listening_party_completion', 'track_purchase', 'album_purchase', 'tip', 'premium_renewal', 'share_visit', 'share_signup', 'state_discovery', 'new_artist_discovery');--> statement-breakpoint
CREATE TYPE "public"."fan_value_tier" AS ENUM('new', 'casual', 'engaged', 'high_value', 'superfan');--> statement-breakpoint
CREATE TYPE "public"."ledger_account_type" AS ENUM('asset', 'liability', 'revenue', 'expense', 'equity');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_side" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."ledger_transaction_status" AS ENUM('pending', 'posted', 'voided', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."payee_type" AS ENUM('artist', 'label', 'organization', 'external');--> statement-breakpoint
CREATE TYPE "public"."payout_hold_status" AS ENUM('active', 'released', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."playback_event_source" AS ENUM('artist_profile', 'album', 'playlist', 'library', 'search', 'semantic_search', 'recommendation', 'state_discovery', 'national_discovery', 'global_discovery', 'map', 'community', 'listening_party', 'battle', 'vod', 'purchase_library', 'share', 'external_deep_link');--> statement-breakpoint
CREATE TYPE "public"."playback_session_status" AS ENUM('started', 'active', 'ended', 'expired', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."qualified_stream_status" AS ENUM('qualified', 'duplicate', 'held', 'rejected', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."reward_configuration_status" AS ENUM('draft', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."reward_unit_status" AS ENUM('pending', 'eligible', 'held', 'rejected', 'allocated', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."reward_unit_type" AS ENUM('premium_track_stream', 'ad_supported_video_view', 'ad_supported_track_stream', 'live_party_attendance', 'battle_attendance', 'battle_round_completion', 'promotional_bonus', 'manual_adjustment', 'purchase_bonus', 'referral_bonus');--> statement-breakpoint
CREATE TYPE "public"."rightsholder_split_status" AS ENUM('draft', 'active', 'disputed', 'retired');--> statement-breakpoint
CREATE TYPE "public"."risk_status" AS ENUM('clear', 'review', 'held', 'rejected', 'released');--> statement-breakpoint
CREATE TYPE "public"."subscription_reward_allocation_status" AS ENUM('pending', 'funded', 'partially_refunded', 'refunded', 'disputed', 'reversed', 'allocated', 'closed');--> statement-breakpoint
CREATE TABLE "accounting_periods" (
	"calculated_at" timestamp,
	"closed_at" timestamp,
	"configuration_version_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"ends_at" timestamp NOT NULL,
	"finalized_at" timestamp,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"payable_at" timestamp,
	"period_type" text DEFAULT 'monthly' NOT NULL,
	"starts_at" timestamp NOT NULL,
	"status" "accounting_period_status" DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_revenue_periods" (
	"accounting_period_id" text,
	"ad_serving_cost_cents" integer DEFAULT 0 NOT NULL,
	"collected_revenue_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"creator_pool_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"invalid_traffic_adjustment_cents" integer DEFAULT 0 NOT NULL,
	"net_revenue_cents" integer NOT NULL,
	"provider" text NOT NULL,
	"refunds_cents" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_earnings" (
	"accounting_period_id" text,
	"artist_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"earning_type" "creator_earning_type" NOT NULL,
	"gross_amount_cents" integer NOT NULL,
	"held_amount_cents" integer DEFAULT 0 NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"ledger_transaction_id" text,
	"metadata" jsonb,
	"payable_amount_cents" integer DEFAULT 0 NOT NULL,
	"payee_id" text,
	"payee_type" "payee_type",
	"quantity" integer DEFAULT 1 NOT NULL,
	"reward_unit_id" text,
	"rule_version" integer,
	"split_version" integer,
	"status" "creator_earning_status" DEFAULT 'estimated' NOT NULL,
	"track_id" text,
	"unit_rate_cents" integer
);
--> statement-breakpoint
CREATE TABLE "creator_statement_items" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"earning_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"statement_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_statements" (
	"accounting_period_id" text,
	"artist_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"finalized_at" timestamp,
	"gross_amount_cents" integer DEFAULT 0 NOT NULL,
	"held_amount_cents" integer DEFAULT 0 NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"paid_amount_cents" integer DEFAULT 0 NOT NULL,
	"payable_amount_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fan_artist_relationships" (
	"artist_user_id" text NOT NULL,
	"battle_votes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"engagement_tier" "fan_value_tier" DEFAULT 'new' NOT NULL,
	"first_engaged_at" timestamp,
	"follows" integer DEFAULT 0 NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"last_engaged_at" timestamp,
	"lifetime_score" integer DEFAULT 0 NOT NULL,
	"live_attendance_seconds" integer DEFAULT 0 NOT NULL,
	"net_purchase_value_cents" integer DEFAULT 0 NOT NULL,
	"purchase_count" integer DEFAULT 0 NOT NULL,
	"qualified_stream_count" integer DEFAULT 0 NOT NULL,
	"raw_play_count" integer DEFAULT 0 NOT NULL,
	"rolling_30_day_score" integer DEFAULT 0 NOT NULL,
	"rolling_90_day_score" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"score_version" integer NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fan_value_events" (
	"artist_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"event_type" "fan_value_event_type" NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp NOT NULL,
	"points" integer NOT NULL,
	"score_version" integer NOT NULL,
	"source_id" text,
	"source_type" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"account_type" "ledger_account_type" NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"name" text NOT NULL,
	"owner_user_id" text
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"account_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"side" "ledger_entry_side" NOT NULL,
	"transaction_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"accounting_period_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb,
	"posted_at" timestamp,
	"reversed_transaction_id" text,
	"source_id" text,
	"source_type" text NOT NULL,
	"status" "ledger_transaction_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_holds" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text,
	"expires_at" timestamp,
	"hold_reason" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"released_at" timestamp,
	"released_by_user_id" text,
	"status" "payout_hold_status" DEFAULT 'active' NOT NULL,
	"target_id" text NOT NULL,
	"target_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playback_sessions" (
	"asset_id" text,
	"city" text,
	"client_type" text,
	"client_version" text,
	"country_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"entitlement_snapshot" jsonb,
	"id" text PRIMARY KEY NOT NULL,
	"last_heartbeat_at" timestamp,
	"muted_seconds" integer DEFAULT 0 NOT NULL,
	"organization_id" text,
	"played_seconds" integer DEFAULT 0 NOT NULL,
	"premium_at_start" boolean DEFAULT false NOT NULL,
	"region_code" text,
	"risk_status" "risk_status" DEFAULT 'clear' NOT NULL,
	"session_token_hash" text,
	"source_id" text,
	"source_type" "playback_event_source" NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"status" "playback_session_status" DEFAULT 'started' NOT NULL,
	"track_id" text NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "qualified_streams" (
	"accounting_period_id" text,
	"configuration_version_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text,
	"playback_session_id" text,
	"qualification_window_key" text NOT NULL,
	"qualified_at" timestamp NOT NULL,
	"risk_status" "risk_status" DEFAULT 'clear' NOT NULL,
	"rule_version" integer NOT NULL,
	"source_id" text,
	"source_type" "playback_event_source" NOT NULL,
	"status" "qualified_stream_status" DEFAULT 'qualified' NOT NULL,
	"track_id" text NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "recording_rightsholders" (
	"approved_at" timestamp,
	"approved_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"effective_from" timestamp NOT NULL,
	"effective_to" timestamp,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"payee_id" text NOT NULL,
	"payee_type" "payee_type" NOT NULL,
	"share_basis_points" integer NOT NULL,
	"split_version" integer NOT NULL,
	"status" "rightsholder_split_status" DEFAULT 'draft' NOT NULL,
	"track_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_configuration_versions" (
	"accounting_cadence" text DEFAULT 'monthly' NOT NULL,
	"ad_creator_share_basis_points" integer DEFAULT 5000 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text,
	"creator_allocation_cents" integer DEFAULT 500 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"deduplication_window_hours" integer DEFAULT 24 NOT NULL,
	"effective_from" timestamp NOT NULL,
	"effective_to" timestamp,
	"fan_value_weights" jsonb NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"live_rewards_enabled" boolean DEFAULT false NOT NULL,
	"minimum_payout_cents" integer DEFAULT 2500 NOT NULL,
	"playback_threshold_percent" integer DEFAULT 50 NOT NULL,
	"playback_threshold_seconds" integer DEFAULT 30 NOT NULL,
	"premium_price_cents" integer DEFAULT 1999 NOT NULL,
	"reserve_days" integer DEFAULT 30 NOT NULL,
	"status" "reward_configuration_status" DEFAULT 'draft' NOT NULL,
	"unused_allocation_strategy" text DEFAULT 'return_to_platform' NOT NULL,
	"version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_units" (
	"accounting_period_id" text,
	"artist_user_id" text,
	"configuration_version_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"qualified_stream_id" text,
	"risk_status" "risk_status" DEFAULT 'clear' NOT NULL,
	"source_id" text,
	"source_type" "playback_event_source",
	"status" "reward_unit_status" DEFAULT 'pending' NOT NULL,
	"track_id" text,
	"unit_type" "reward_unit_type" NOT NULL,
	"user_id" text,
	"weight_basis_points" integer DEFAULT 10000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlement_runs" (
	"accounting_period_id" text NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"error" jsonb,
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb,
	"run_type" text DEFAULT 'monthly_settlement' NOT NULL,
	"started_at" timestamp,
	"status" "workflow_job_status" DEFAULT 'queued' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_reward_allocations" (
	"accounting_period_id" text,
	"allocated_at" timestamp,
	"allocation_status" "subscription_reward_allocation_status" DEFAULT 'pending' NOT NULL,
	"configuration_version_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"creator_allocation_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"funded_at" timestamp,
	"gross_subscription_amount_cents" integer NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"reversed_at" timestamp,
	"stripe_invoice_id" text,
	"stripe_payment_intent_id" text,
	"subscription_id" text,
	"subscription_period_end" timestamp,
	"subscription_period_start" timestamp NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_ad_campaigns" (
	"advertiser_user_id" text,
	"budget_cents" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"ends_at" timestamp,
	"id" text PRIMARY KEY NOT NULL,
	"inventory_type" "ad_inventory_type" NOT NULL,
	"metadata" jsonb,
	"starts_at" timestamp NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"target_regions" jsonb,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_ad_impressions" (
	"accounting_period_id" text,
	"campaign_id" text,
	"city" text,
	"country_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"impression_value_cents" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp NOT NULL,
	"region_code" text,
	"status" "ad_impression_status" DEFAULT 'requested' NOT NULL,
	"user_id" text,
	"video_id" text
);
--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_configuration_version_id_reward_configuration_versions_id_fk" FOREIGN KEY ("configuration_version_id") REFERENCES "public"."reward_configuration_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_revenue_periods" ADD CONSTRAINT "ad_revenue_periods_accounting_period_id_accounting_periods_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_earnings" ADD CONSTRAINT "creator_earnings_accounting_period_id_accounting_periods_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_earnings" ADD CONSTRAINT "creator_earnings_artist_user_id_user_id_fk" FOREIGN KEY ("artist_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_earnings" ADD CONSTRAINT "creator_earnings_ledger_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_earnings" ADD CONSTRAINT "creator_earnings_reward_unit_id_reward_units_id_fk" FOREIGN KEY ("reward_unit_id") REFERENCES "public"."reward_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_earnings" ADD CONSTRAINT "creator_earnings_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_statement_items" ADD CONSTRAINT "creator_statement_items_earning_id_creator_earnings_id_fk" FOREIGN KEY ("earning_id") REFERENCES "public"."creator_earnings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_statement_items" ADD CONSTRAINT "creator_statement_items_statement_id_creator_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."creator_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_statements" ADD CONSTRAINT "creator_statements_accounting_period_id_accounting_periods_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_statements" ADD CONSTRAINT "creator_statements_artist_user_id_user_id_fk" FOREIGN KEY ("artist_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_artist_relationships" ADD CONSTRAINT "fan_artist_relationships_artist_user_id_user_id_fk" FOREIGN KEY ("artist_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_artist_relationships" ADD CONSTRAINT "fan_artist_relationships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_value_events" ADD CONSTRAINT "fan_value_events_artist_user_id_user_id_fk" FOREIGN KEY ("artist_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_value_events" ADD CONSTRAINT "fan_value_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_accounting_period_id_accounting_periods_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_holds" ADD CONSTRAINT "payout_holds_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_holds" ADD CONSTRAINT "payout_holds_released_by_user_id_user_id_fk" FOREIGN KEY ("released_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_asset_id_track_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."track_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualified_streams" ADD CONSTRAINT "qualified_streams_accounting_period_id_accounting_periods_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualified_streams" ADD CONSTRAINT "qualified_streams_configuration_version_id_reward_configuration_versions_id_fk" FOREIGN KEY ("configuration_version_id") REFERENCES "public"."reward_configuration_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualified_streams" ADD CONSTRAINT "qualified_streams_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualified_streams" ADD CONSTRAINT "qualified_streams_playback_session_id_playback_sessions_id_fk" FOREIGN KEY ("playback_session_id") REFERENCES "public"."playback_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualified_streams" ADD CONSTRAINT "qualified_streams_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualified_streams" ADD CONSTRAINT "qualified_streams_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_rightsholders" ADD CONSTRAINT "recording_rightsholders_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_rightsholders" ADD CONSTRAINT "recording_rightsholders_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_configuration_versions" ADD CONSTRAINT "reward_configuration_versions_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_units" ADD CONSTRAINT "reward_units_accounting_period_id_accounting_periods_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_units" ADD CONSTRAINT "reward_units_artist_user_id_user_id_fk" FOREIGN KEY ("artist_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_units" ADD CONSTRAINT "reward_units_configuration_version_id_reward_configuration_versions_id_fk" FOREIGN KEY ("configuration_version_id") REFERENCES "public"."reward_configuration_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_units" ADD CONSTRAINT "reward_units_qualified_stream_id_qualified_streams_id_fk" FOREIGN KEY ("qualified_stream_id") REFERENCES "public"."qualified_streams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_units" ADD CONSTRAINT "reward_units_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_units" ADD CONSTRAINT "reward_units_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_runs" ADD CONSTRAINT "settlement_runs_accounting_period_id_accounting_periods_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_reward_allocations" ADD CONSTRAINT "subscription_reward_allocations_accounting_period_id_accounting_periods_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_reward_allocations" ADD CONSTRAINT "subscription_reward_allocations_configuration_version_id_reward_configuration_versions_id_fk" FOREIGN KEY ("configuration_version_id") REFERENCES "public"."reward_configuration_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_reward_allocations" ADD CONSTRAINT "subscription_reward_allocations_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_reward_allocations" ADD CONSTRAINT "subscription_reward_allocations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_ad_campaigns" ADD CONSTRAINT "video_ad_campaigns_advertiser_user_id_user_id_fk" FOREIGN KEY ("advertiser_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_ad_impressions" ADD CONSTRAINT "video_ad_impressions_accounting_period_id_accounting_periods_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_ad_impressions" ADD CONSTRAINT "video_ad_impressions_campaign_id_video_ad_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."video_ad_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_ad_impressions" ADD CONSTRAINT "video_ad_impressions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_ad_impressions" ADD CONSTRAINT "video_ad_impressions_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_periods_window_idx" ON "accounting_periods" USING btree ("period_type","currency","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "accounting_periods_status_idx" ON "accounting_periods" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_revenue_periods_provider_period_idx" ON "ad_revenue_periods" USING btree ("provider","accounting_period_id");--> statement-breakpoint
CREATE INDEX "creator_earnings_artist_period_idx" ON "creator_earnings" USING btree ("artist_user_id","accounting_period_id");--> statement-breakpoint
CREATE INDEX "creator_earnings_status_idx" ON "creator_earnings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_statement_items_statement_earning_idx" ON "creator_statement_items" USING btree ("statement_id","earning_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_statements_artist_period_idx" ON "creator_statements" USING btree ("artist_user_id","accounting_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fan_artist_relationships_user_artist_idx" ON "fan_artist_relationships" USING btree ("user_id","artist_user_id");--> statement-breakpoint
CREATE INDEX "fan_artist_relationships_artist_tier_idx" ON "fan_artist_relationships" USING btree ("artist_user_id","engagement_tier");--> statement-breakpoint
CREATE INDEX "fan_value_events_user_artist_idx" ON "fan_value_events" USING btree ("user_id","artist_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "fan_value_events_artist_idx" ON "fan_value_events" USING btree ("artist_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_code_currency_owner_idx" ON "ledger_accounts" USING btree ("code","currency","owner_user_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_transaction_idx" ON "ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_account_idx" ON "ledger_entries" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_transactions_idempotency_key_idx" ON "ledger_transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ledger_transactions_period_idx" ON "ledger_transactions" USING btree ("accounting_period_id");--> statement-breakpoint
CREATE INDEX "payout_holds_target_idx" ON "payout_holds" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "payout_holds_status_idx" ON "payout_holds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "playback_sessions_user_track_idx" ON "playback_sessions" USING btree ("user_id","track_id");--> statement-breakpoint
CREATE INDEX "playback_sessions_source_idx" ON "playback_sessions" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "playback_sessions_started_at_idx" ON "playback_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "qualified_streams_listener_track_window_idx" ON "qualified_streams" USING btree ("user_id","track_id","qualification_window_key","rule_version");--> statement-breakpoint
CREATE INDEX "qualified_streams_period_status_idx" ON "qualified_streams" USING btree ("accounting_period_id","status");--> statement-breakpoint
CREATE INDEX "qualified_streams_track_idx" ON "qualified_streams" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "recording_rightsholders_track_status_idx" ON "recording_rightsholders" USING btree ("track_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "recording_rightsholders_track_payee_version_idx" ON "recording_rightsholders" USING btree ("track_id","payee_type","payee_id","split_version");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_configuration_versions_version_idx" ON "reward_configuration_versions" USING btree ("version");--> statement-breakpoint
CREATE INDEX "reward_configuration_versions_status_idx" ON "reward_configuration_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reward_units_user_period_idx" ON "reward_units" USING btree ("user_id","accounting_period_id");--> statement-breakpoint
CREATE INDEX "reward_units_artist_period_idx" ON "reward_units" USING btree ("artist_user_id","accounting_period_id");--> statement-breakpoint
CREATE INDEX "reward_units_status_idx" ON "reward_units" USING btree ("status","risk_status");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_runs_idempotency_key_idx" ON "settlement_runs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "settlement_runs_period_idx" ON "settlement_runs" USING btree ("accounting_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_reward_allocations_invoice_idx" ON "subscription_reward_allocations" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE INDEX "subscription_reward_allocations_user_period_idx" ON "subscription_reward_allocations" USING btree ("user_id","subscription_period_start");--> statement-breakpoint
CREATE INDEX "subscription_reward_allocations_accounting_period_idx" ON "subscription_reward_allocations" USING btree ("accounting_period_id");--> statement-breakpoint
CREATE INDEX "video_ad_campaigns_status_idx" ON "video_ad_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "video_ad_campaigns_window_idx" ON "video_ad_campaigns" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "video_ad_impressions_video_period_idx" ON "video_ad_impressions" USING btree ("video_id","accounting_period_id");--> statement-breakpoint
CREATE INDEX "video_ad_impressions_campaign_idx" ON "video_ad_impressions" USING btree ("campaign_id");