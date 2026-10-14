import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { orders, projects, tracks } from "./app";
import { user } from "./auth";
import { fulfillmentProviderEnum } from "./commerce";

export const merchStatusEnum = pgEnum("merch_status", [
  "draft",
  "ready",
  "published",
  "archived",
]);
export type MerchStatus = (typeof merchStatusEnum.enumValues)[number];

export const mockupTaskStatusEnum = pgEnum("mockup_task_status", [
  "queued",
  "pending",
  "completed",
  "failed",
]);
export type MockupTaskStatus = (typeof mockupTaskStatusEnum.enumValues)[number];

export const merchCatalogProducts = pgTable(
  "merch_catalog_products",
  {
    brand: text("brand"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    image: text("image"),
    isCurated: boolean("is_curated").default(true).notNull(),
    isDiscontinued: boolean("is_discontinued").default(false).notNull(),
    mockupStyleIds: jsonb("mockup_style_ids")
      .$type<number[]>()
      .default([])
      .notNull(),
    name: text("name").notNull(),
    placements: jsonb("placements")
      .$type<Record<string, unknown>[]>()
      .default([])
      .notNull(),
    printFileRules: jsonb("print_file_rules").$type<Record<string, unknown>>(),
    retailMaxCents: integer("retail_max_cents").notNull(),
    retailMinCents: integer("retail_min_cents").notNull(),
    syncedAt: timestamp("synced_at").defaultNow().notNull(),
    techniques: jsonb("techniques")
      .$type<Record<string, unknown>[]>()
      .default([])
      .notNull(),
    type: text("type"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("merch_catalog_products_is_curated_idx").on(table.isCurated),
    index("merch_catalog_products_is_discontinued_idx").on(
      table.isDiscontinued
    ),
  ]
);

export const merchCatalogVariants = pgTable(
  "merch_catalog_variants",
  {
    availability: jsonb("availability").$type<Record<string, unknown>>(),
    basePriceCents: integer("base_price_cents").notNull(),
    catalogProductId: text("catalog_product_id")
      .notNull()
      .references(() => merchCatalogProducts.id, { onDelete: "cascade" }),
    color: text("color"),
    colorCode: text("color_code"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    image: text("image"),
    inStock: boolean("in_stock").default(true).notNull(),
    name: text("name").notNull(),
    size: text("size"),
    syncedAt: timestamp("synced_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("merch_catalog_variants_catalog_product_id_idx").on(
      table.catalogProductId
    ),
    index("merch_catalog_variants_in_stock_idx").on(table.inStock),
  ]
);

export const merchDesigns = pgTable(
  "merch_designs",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    designFileObjectKey: text("design_file_object_key").notNull(),
    designFileUrl: text("design_file_url"),
    designMetadata: jsonb("design_metadata").$type<{
      dpi?: number;
      format?: string;
      hasAlpha?: boolean;
      height?: number;
      width?: number;
    }>(),
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    placement: text("placement").notNull(),
    platformFeeBps: integer("platform_fee_bps").default(1200).notNull(),
    printfulCatalogProductId: text("printful_catalog_product_id").references(
      () => merchCatalogProducts.id,
      { onDelete: "set null" }
    ),
    printfulFileId: text("printful_file_id"),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at"),
    retailPriceCents: integer("retail_price_cents").notNull(),
    status: merchStatusEnum("status").default("draft").notNull(),
    technique: text("technique").default("dtg").notNull(),
    title: text("title").notNull(),
    trackId: text("track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("merch_designs_owner_user_id_idx").on(table.ownerUserId),
    index("merch_designs_project_id_idx").on(table.projectId),
    index("merch_designs_track_id_idx").on(table.trackId),
    index("merch_designs_status_idx").on(table.status),
    uniqueIndex("merch_designs_active_owner_blank_placement_file_idx")
      .on(
        table.ownerUserId,
        table.printfulCatalogProductId,
        table.placement,
        table.designFileObjectKey
      )
      .where(
        sql`status <> 'archived' AND printful_catalog_product_id IS NOT NULL`
      ),
  ]
);

export const merchMockups = pgTable(
  "merch_mockups",
  {
    catalogVariantId: text("catalog_variant_id")
      .notNull()
      .references(() => merchCatalogVariants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    error: text("error"),
    id: text("id").primaryKey(),
    merchDesignId: text("merch_design_id")
      .notNull()
      .references(() => merchDesigns.id, { onDelete: "cascade" }),
    mockupUrl: text("mockup_url"),
    printfulTaskId: text("printful_task_id"),
    status: mockupTaskStatusEnum("status").default("queued").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("merch_mockups_printful_task_id_idx").on(table.printfulTaskId),
    index("merch_mockups_status_idx").on(table.status),
    uniqueIndex("merch_mockups_design_variant_idx").on(
      table.merchDesignId,
      table.catalogVariantId
    ),
  ]
);

export const merchFulfillments = pgTable(
  "merch_fulfillments",
  {
    confirmedAt: timestamp("confirmed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    externalId: text("external_id").notNull(),
    id: text("id").primaryKey(),
    lastError: text("last_error"),
    lastSyncedAt: timestamp("last_synced_at"),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    printfulCosts: jsonb("printful_costs").$type<Record<string, unknown>>(),
    printfulOrderId: text("printful_order_id"),
    status: text("status").default("draft").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("merch_fulfillments_external_id_idx").on(table.externalId),
    uniqueIndex("merch_fulfillments_order_id_idx").on(table.orderId),
    uniqueIndex("merch_fulfillments_printful_order_id_idx").on(
      table.printfulOrderId
    ),
  ]
);

export const merchShipments = pgTable(
  "merch_shipments",
  {
    carrier: text("carrier"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deliveredAt: timestamp("delivered_at"),
    departureCountry: text("departure_country"),
    estimatedDelivery: jsonb("estimated_delivery").$type<{
      calculatedAt?: string;
      fromDate?: string;
      toDate?: string;
    }>(),
    fulfillmentId: text("fulfillment_id")
      .notNull()
      .references(() => merchFulfillments.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    isReshipment: boolean("is_reshipment").default(false).notNull(),
    printfulShipmentId: text("printful_shipment_id"),
    service: text("service"),
    shippedAt: timestamp("shipped_at"),
    status: text("status").notNull(),
    trackingEvents: jsonb("tracking_events")
      .$type<{ description?: string; triggeredAt?: string }[]>()
      .default([])
      .notNull(),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("merch_shipments_fulfillment_id_idx").on(table.fulfillmentId),
    uniqueIndex("merch_shipments_printful_shipment_id_idx").on(
      table.printfulShipmentId
    ),
  ]
);

export const orderShippingSelections = pgTable(
  "order_shipping_selections",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    optionCode: text("option_code").notNull(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents").notNull(),
    provider: fulfillmentProviderEnum("provider").notNull(),
  },
  (table) => [
    uniqueIndex("order_shipping_selections_order_provider_idx").on(
      table.orderId,
      table.provider
    ),
  ]
);
