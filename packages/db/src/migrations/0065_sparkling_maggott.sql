CREATE TYPE "public"."merch_status" AS ENUM('draft', 'ready', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."mockup_task_status" AS ENUM('queued', 'pending', 'completed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."physical_fulfillment_status" ADD VALUE 'printful_processing' BEFORE 'shipped';--> statement-breakpoint
ALTER TYPE "public"."webhook_provider" ADD VALUE 'printful';--> statement-breakpoint
CREATE TABLE "merch_catalog_products" (
	"brand" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"is_curated" boolean DEFAULT true NOT NULL,
	"is_discontinued" boolean DEFAULT false NOT NULL,
	"mockup_style_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"name" text NOT NULL,
	"placements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"print_file_rules" jsonb,
	"retail_max_cents" integer NOT NULL,
	"retail_min_cents" integer NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"techniques" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"type" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merch_catalog_variants" (
	"availability" jsonb,
	"base_price_cents" integer NOT NULL,
	"catalog_product_id" text NOT NULL,
	"color" text,
	"color_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"in_stock" boolean DEFAULT true NOT NULL,
	"name" text NOT NULL,
	"size" text,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merch_designs" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"design_file_object_key" text NOT NULL,
	"design_file_url" text,
	"design_metadata" jsonb,
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"placement" text NOT NULL,
	"platform_fee_bps" integer DEFAULT 1200 NOT NULL,
	"printful_catalog_product_id" text,
	"printful_file_id" text,
	"project_id" text,
	"published_at" timestamp,
	"retail_price_cents" integer NOT NULL,
	"status" "merch_status" DEFAULT 'draft' NOT NULL,
	"technique" text DEFAULT 'dtg' NOT NULL,
	"title" text NOT NULL,
	"track_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merch_fulfillments" (
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"external_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"last_error" text,
	"last_synced_at" timestamp,
	"order_id" text NOT NULL,
	"printful_costs" jsonb,
	"printful_order_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merch_mockups" (
	"catalog_variant_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"error" text,
	"id" text PRIMARY KEY NOT NULL,
	"merch_design_id" text NOT NULL,
	"mockup_url" text,
	"printful_task_id" text,
	"status" "mockup_task_status" DEFAULT 'queued' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merch_shipments" (
	"carrier" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"departure_country" text,
	"estimated_delivery" jsonb,
	"fulfillment_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"is_reshipment" boolean DEFAULT false NOT NULL,
	"printful_shipment_id" text,
	"service" text,
	"shipped_at" timestamp,
	"status" text NOT NULL,
	"tracking_events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tracking_number" text,
	"tracking_url" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_shipping_selections" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"option_code" text NOT NULL,
	"order_id" text NOT NULL,
	"price_cents" integer NOT NULL,
	"provider" "fulfillment_provider" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "merch_design_id" text;--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "printful_variant_id" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "merch_design_id" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "printful_variant_id" text;--> statement-breakpoint
ALTER TABLE "merch_catalog_variants" ADD CONSTRAINT "merch_catalog_variants_catalog_product_id_merch_catalog_products_id_fk" FOREIGN KEY ("catalog_product_id") REFERENCES "public"."merch_catalog_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merch_designs" ADD CONSTRAINT "merch_designs_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merch_designs" ADD CONSTRAINT "merch_designs_printful_catalog_product_id_merch_catalog_products_id_fk" FOREIGN KEY ("printful_catalog_product_id") REFERENCES "public"."merch_catalog_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merch_designs" ADD CONSTRAINT "merch_designs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merch_designs" ADD CONSTRAINT "merch_designs_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merch_fulfillments" ADD CONSTRAINT "merch_fulfillments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merch_mockups" ADD CONSTRAINT "merch_mockups_catalog_variant_id_merch_catalog_variants_id_fk" FOREIGN KEY ("catalog_variant_id") REFERENCES "public"."merch_catalog_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merch_mockups" ADD CONSTRAINT "merch_mockups_merch_design_id_merch_designs_id_fk" FOREIGN KEY ("merch_design_id") REFERENCES "public"."merch_designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merch_shipments" ADD CONSTRAINT "merch_shipments_fulfillment_id_merch_fulfillments_id_fk" FOREIGN KEY ("fulfillment_id") REFERENCES "public"."merch_fulfillments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_shipping_selections" ADD CONSTRAINT "order_shipping_selections_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merch_catalog_products_is_curated_idx" ON "merch_catalog_products" USING btree ("is_curated");--> statement-breakpoint
CREATE INDEX "merch_catalog_products_is_discontinued_idx" ON "merch_catalog_products" USING btree ("is_discontinued");--> statement-breakpoint
CREATE INDEX "merch_catalog_variants_catalog_product_id_idx" ON "merch_catalog_variants" USING btree ("catalog_product_id");--> statement-breakpoint
CREATE INDEX "merch_catalog_variants_in_stock_idx" ON "merch_catalog_variants" USING btree ("in_stock");--> statement-breakpoint
CREATE INDEX "merch_designs_owner_user_id_idx" ON "merch_designs" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "merch_designs_project_id_idx" ON "merch_designs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "merch_designs_track_id_idx" ON "merch_designs" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "merch_designs_status_idx" ON "merch_designs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "merch_designs_active_owner_blank_placement_file_idx" ON "merch_designs" USING btree ("owner_user_id","printful_catalog_product_id","placement","design_file_object_key") WHERE status <> 'archived';--> statement-breakpoint
CREATE UNIQUE INDEX "merch_fulfillments_external_id_idx" ON "merch_fulfillments" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merch_fulfillments_order_id_idx" ON "merch_fulfillments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merch_fulfillments_printful_order_id_idx" ON "merch_fulfillments" USING btree ("printful_order_id");--> statement-breakpoint
CREATE INDEX "merch_mockups_printful_task_id_idx" ON "merch_mockups" USING btree ("printful_task_id");--> statement-breakpoint
CREATE INDEX "merch_mockups_status_idx" ON "merch_mockups" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "merch_mockups_design_variant_idx" ON "merch_mockups" USING btree ("merch_design_id","catalog_variant_id");--> statement-breakpoint
CREATE INDEX "merch_shipments_fulfillment_id_idx" ON "merch_shipments" USING btree ("fulfillment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merch_shipments_printful_shipment_id_idx" ON "merch_shipments" USING btree ("printful_shipment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_shipping_selections_order_provider_idx" ON "order_shipping_selections" USING btree ("order_id","provider");--> statement-breakpoint
CREATE INDEX "cart_items_merch_design_id_idx" ON "cart_items" USING btree ("merch_design_id");--> statement-breakpoint
CREATE INDEX "cart_items_printful_variant_id_idx" ON "cart_items" USING btree ("printful_variant_id");--> statement-breakpoint
CREATE INDEX "order_items_merch_design_id_idx" ON "order_items" USING btree ("merch_design_id");--> statement-breakpoint
CREATE INDEX "order_items_printful_variant_id_idx" ON "order_items" USING btree ("printful_variant_id");