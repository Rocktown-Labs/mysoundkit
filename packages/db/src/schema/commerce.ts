import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth";

export const fulfillmentProviderEnum = pgEnum("fulfillment_provider", [
  "none",
  "manual",
  "printful",
]);

export type FulfillmentProvider =
  (typeof fulfillmentProviderEnum.enumValues)[number];

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
