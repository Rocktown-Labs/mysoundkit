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

import { subscription, user } from "./auth";

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

export const aiCreditGrants = pgTable(
  "ai_credit_grants",
  {
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    grantedByUserId: text("granted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    reason: text("reason"),
    source: text("source").default("admin_grant").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("ai_credit_grants_user_id_idx").on(table.userId),
    index("ai_credit_grants_created_at_idx").on(table.createdAt),
  ]
);
