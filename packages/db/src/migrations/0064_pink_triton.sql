CREATE TYPE "public"."physical_fulfillment_status" AS ENUM('not_applicable', 'pending', 'kunaki_processing', 'shipped', 'delivered', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."physical_media_format" AS ENUM('cd', 'vinyl_12', 'vinyl_7', 'dvd');--> statement-breakpoint
CREATE TYPE "public"."physical_release_status" AS ENUM('draft', 'ready', 'published', 'archived');--> statement-breakpoint
ALTER TYPE "public"."product_type" ADD VALUE 'physical_merch';--> statement-breakpoint
ALTER TYPE "public"."purchase_mode" ADD VALUE 'physical_merch';--> statement-breakpoint
ALTER TYPE "public"."fulfillment_provider" ADD VALUE 'kunaki';--> statement-breakpoint
CREATE TABLE "physical_releases" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"includes_digital_download" boolean DEFAULT true NOT NULL,
	"kunaki_product_id" text,
	"manufacturing_base_cents" integer NOT NULL,
	"media_format" "physical_media_format" NOT NULL,
	"metadata" jsonb,
	"owner_user_id" text NOT NULL,
	"packaging_assets" jsonb,
	"platform_fee_bps" integer DEFAULT 1200 NOT NULL,
	"project_id" text,
	"retail_price_cents" integer NOT NULL,
	"status" "physical_release_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"track_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"video_id" text
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "physical_release_id" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "artist_payout_cents_snapshot" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "manufacturing_base_cents_snapshot" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "physical_release_id" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "platform_fee_cents_snapshot" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfillment_status" "physical_fulfillment_status" DEFAULT 'not_applicable' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "kunaki_order_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipped_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_address1" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_address2" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_city" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_company" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_country" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_description" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_fee_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_postal_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_state_province" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_type" text;--> statement-breakpoint
ALTER TABLE "physical_releases" ADD CONSTRAINT "physical_releases_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_releases" ADD CONSTRAINT "physical_releases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_releases" ADD CONSTRAINT "physical_releases_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_releases" ADD CONSTRAINT "physical_releases_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "physical_releases_owner_user_id_idx" ON "physical_releases" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "physical_releases_project_id_idx" ON "physical_releases" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "physical_releases_kunaki_product_id_idx" ON "physical_releases" USING btree ("kunaki_product_id");--> statement-breakpoint
CREATE INDEX "physical_releases_media_format_idx" ON "physical_releases" USING btree ("media_format");--> statement-breakpoint
CREATE INDEX "physical_releases_status_idx" ON "physical_releases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cart_items_physical_release_id_idx" ON "cart_items" USING btree ("physical_release_id");--> statement-breakpoint
CREATE INDEX "order_items_physical_release_id_idx" ON "order_items" USING btree ("physical_release_id");--> statement-breakpoint
CREATE INDEX "orders_fulfillment_status_idx" ON "orders" USING btree ("fulfillment_status");--> statement-breakpoint
CREATE INDEX "orders_kunaki_order_id_idx" ON "orders" USING btree ("kunaki_order_id");