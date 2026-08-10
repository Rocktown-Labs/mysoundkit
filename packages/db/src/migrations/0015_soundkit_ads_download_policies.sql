CREATE TYPE "public"."ad_campaign_status" AS ENUM('draft', 'active', 'paused', 'exhausted_for_today', 'expired');--> statement-breakpoint
CREATE TYPE "public"."ad_billing_type" AS ENUM('upfront_recurring', 'prepaid_wallet');--> statement-breakpoint
CREATE TYPE "public"."ad_target_type" AS ENUM('state', 'country');--> statement-breakpoint
CREATE TYPE "public"."ad_creative_format" AS ENUM('audio', 'video', 'image');--> statement-breakpoint
CREATE TYPE "public"."ad_placement" AS ENUM('audio_preroll', 'video_preroll', 'video_overlay');--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "downloads_allowed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "downloads_require_first_play" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "downloads_require_purchase" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE TABLE "user_wallets" (
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_campaigns" (
	"advertiser_id" text NOT NULL,
	"billing_type" "ad_billing_type" DEFAULT 'prepaid_wallet' NOT NULL,
	"clickthrough_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"creative_format" "ad_creative_format" DEFAULT 'audio' NOT NULL,
	"creative_image_url" text,
	"creative_url" text NOT NULL,
	"daily_budget_cents" integer DEFAULT 500 NOT NULL,
	"daily_impression_cap" integer DEFAULT 1000 NOT NULL,
	"end_date" timestamp,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"placement" "ad_placement" DEFAULT 'audio_preroll' NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"status" "ad_campaign_status" DEFAULT 'draft' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_subscription_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_campaign_targets" (
	"campaign_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"target_code" text NOT NULL,
	"target_type" "ad_target_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_metric_daily" (
	"campaign_id" text NOT NULL,
	"clicks_count" integer DEFAULT 0 NOT NULL,
	"date" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"impressions_count" integer DEFAULT 0 NOT NULL,
	"spend_cents" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_advertiser_id_user_id_fk" FOREIGN KEY ("advertiser_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_campaign_targets" ADD CONSTRAINT "ad_campaign_targets_campaign_id_ad_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_metric_daily" ADD CONSTRAINT "ad_metric_daily_campaign_id_ad_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_wallets_user_id_idx" ON "user_wallets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_wallets_stripe_customer_idx" ON "user_wallets" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "ad_campaigns_advertiser_idx" ON "ad_campaigns" USING btree ("advertiser_id");--> statement-breakpoint
CREATE INDEX "ad_campaigns_placement_idx" ON "ad_campaigns" USING btree ("placement");--> statement-breakpoint
CREATE INDEX "ad_campaigns_status_dates_idx" ON "ad_campaigns" USING btree ("status","start_date","end_date");--> statement-breakpoint
CREATE INDEX "ad_campaign_targets_lookup_idx" ON "ad_campaign_targets" USING btree ("target_type","target_code");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_campaign_targets_unique_idx" ON "ad_campaign_targets" USING btree ("campaign_id","target_type","target_code");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_metric_daily_campaign_date_idx" ON "ad_metric_daily" USING btree ("campaign_id","date");--> statement-breakpoint
CREATE INDEX "ad_metric_daily_date_idx" ON "ad_metric_daily" USING btree ("date");
