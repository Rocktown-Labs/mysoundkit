import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const transactionTypeEnum = pgEnum("transaction_type", [
  "product_purchase",
  "tip",
  "community_subscription",
  "platform_subscription",
]);
export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

export const transactions = pgTable(
  "transactions",
  {
    amountCents: integer("amount_cents").notNull(),
    artistAmountCents: integer("artist_amount_cents").notNull(),
    buyerUserId: text("buyer_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata"),
    platformFeeCents: integer("platform_fee_cents").notNull(),
    sellerUserId: text("seller_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    status: transactionStatusEnum("status").default("pending").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    transactionType: transactionTypeEnum("transaction_type").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("transactions_buyer_user_id_idx").on(table.buyerUserId),
    index("transactions_seller_user_id_idx").on(table.sellerUserId),
    uniqueIndex("transactions_stripe_checkout_session_id_idx").on(
      table.stripeCheckoutSessionId
    ),
  ]
);

export const platformFees = pgTable(
  "platform_fees",
  {
    amountCents: integer("amount_cents").notNull(),
    basisPoints: integer("basis_points").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "restrict" }),
  },
  (table) => [index("platform_fees_transaction_id_idx").on(table.transactionId)]
);

export const tips = pgTable(
  "tips",
  {
    amountCents: integer("amount_cents").notNull(),
    artistUserId: text("artist_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    fanUserId: text("fan_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    message: text("message"),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "restrict" }),
  },
  (table) => [index("tips_artist_user_id_idx").on(table.artistUserId)]
);

export const paymentRefunds = pgTable(
  "payment_refunds",
  {
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    reason: text("reason"),
    stripeRefundId: text("stripe_refund_id").notNull(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("payment_refunds_stripe_refund_id_idx").on(
      table.stripeRefundId
    ),
  ]
);

export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    eventType: text("event_type").notNull(),
    id: text("id").primaryKey(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at"),
    status: text("status").default("received").notNull(),
    stripeEventId: text("stripe_event_id").notNull(),
  },
  (table) => [
    uniqueIndex("stripe_webhook_events_stripe_event_id_idx").on(
      table.stripeEventId
    ),
  ]
);

export const payoutRecords = pgTable(
  "payout_records",
  {
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    id: text("id").primaryKey(),
    sellerUserId: text("seller_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull(),
    stripePayoutId: text("stripe_payout_id").notNull(),
  },
  (table) => [
    uniqueIndex("payout_records_stripe_payout_id_idx").on(table.stripePayoutId),
    index("payout_records_seller_user_id_idx").on(table.sellerUserId),
  ]
);
