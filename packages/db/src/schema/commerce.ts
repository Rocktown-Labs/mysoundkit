import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import {
  physicalFulfillmentStatusEnum,
  physicalMediaFormatEnum,
  physicalReleaseStatusEnum,
  projects,
  tracks,
  videos,
} from "./app";
import type {
  PhysicalFulfillmentStatus,
  PhysicalMediaFormat,
  PhysicalReleaseStatus,
} from "./app";
import { organization, user } from "./auth";

export {
  physicalFulfillmentStatusEnum,
  physicalMediaFormatEnum,
  physicalReleaseStatusEnum,
};
export type {
  PhysicalFulfillmentStatus,
  PhysicalMediaFormat,
  PhysicalReleaseStatus,
};

export const fulfillmentProviderEnum = pgEnum("fulfillment_provider", [
  "none",
  "manual",
  "printful",
  "kunaki",
]);

export type FulfillmentProvider =
  (typeof fulfillmentProviderEnum.enumValues)[number];

export const physicalReleases = pgTable(
  "physical_releases",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    includesDigitalDownload: boolean("includes_digital_download")
      .default(true)
      .notNull(),
    kunakiProductId: text("kunaki_product_id"),
    manufacturingBaseCents: integer("manufacturing_base_cents").notNull(),
    mediaFormat: physicalMediaFormatEnum("media_format").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    packagingAssets: jsonb("packaging_assets").$type<{
      centerLabelKey?: string;
      discLabelKey?: string;
      frontCoverKey?: string;
      outerJacketKey?: string;
      trayCardKey?: string;
    }>(),
    platformFeeBps: integer("platform_fee_bps").default(1200).notNull(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    retailPriceCents: integer("retail_price_cents").notNull(),
    status: physicalReleaseStatusEnum("status").default("draft").notNull(),
    title: text("title").notNull(),
    trackId: text("track_id").references(() => tracks.id, {
      onDelete: "cascade",
    }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    videoId: text("video_id").references(() => videos.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [
    index("physical_releases_owner_user_id_idx").on(table.ownerUserId),
    index("physical_releases_project_id_idx").on(table.projectId),
    index("physical_releases_kunaki_product_id_idx").on(table.kunakiProductId),
    index("physical_releases_media_format_idx").on(table.mediaFormat),
    index("physical_releases_status_idx").on(table.status),
  ]
);

export const sellableProducts = pgTable(
  "sellable_products",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    description: text("description"),
    fulfillmentProvider: fulfillmentProviderEnum("fulfillment_provider"),
    fulfillmentProviderReference: text("fulfillment_provider_reference"),
    id: text("id").primaryKey(),
    images: jsonb("images").$type<string[]>().default([]).notNull(),
    inventoryQuantity: integer("inventory_quantity"),
    metadata: jsonb("metadata"),
    name: text("name").notNull(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents").notNull(),
    status: text("status").default("draft").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("sellable_products_owner_user_id_idx").on(table.ownerUserId),
    index("sellable_products_fulfillment_provider_idx").on(
      table.fulfillmentProvider
    ),
  ]
);
