import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { subscription } from "./auth";

export const planCatalog = pgTable(
  "plan_catalog_v2",
  {
    annualPriceCents: integer("annual_price_cents"),
    audience: text("audience").$type<"artist" | "fan">().notNull(),
    code: text("code").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    entitlements: jsonb("entitlements")
      .$type<Record<string, boolean | number | string>>()
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    maxSeats: integer("max_seats"),
    monthlyPriceCents: integer("monthly_price_cents").notNull(),
    name: text("name").notNull(),
    stripeAnnualPriceId: text("stripe_annual_price_id"),
    stripeMonthlyPriceId: text("stripe_monthly_price_id"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("plan_catalog_v2_code_idx").on(table.code)]
);

export const subscriptionEntitlements = pgTable(
  "subscription_entitlements_v2",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    entitlementKey: text("entitlement_key").notNull(),
    entitlementValue: text("entitlement_value").notNull(),
    id: text("id").primaryKey(),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => subscription.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("subscription_entitlements_v2_subscription_id_idx").on(
      table.subscriptionId
    ),
  ]
);
