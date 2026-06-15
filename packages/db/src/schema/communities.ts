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

import { user } from "./auth";

export const communityMemberRoleEnum = pgEnum("community_member_role", [
  "owner",
  "moderator",
  "member",
]);
export const communitySubscriptionStatusEnum = pgEnum(
  "community_subscription_status",
  ["pending", "active", "past_due", "canceled", "expired"]
);
export const communityPostTypeEnum = pgEnum("community_post_type", [
  "text",
  "image",
  "audio",
  "video",
  "poll",
]);

export const communities = pgTable(
  "communities",
  {
    artistUserId: text("artist_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    isActive: boolean("is_active").default(true).notNull(),
    monthlyPriceCents: integer("monthly_price_cents").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    stripePriceId: text("stripe_price_id"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("communities_artist_user_id_idx").on(table.artistUserId),
    uniqueIndex("communities_slug_idx").on(table.slug),
  ]
);

export const communityMembers = pgTable(
  "community_members",
  {
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    role: communityMemberRoleEnum("role").default("member").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("community_members_community_user_idx").on(
      table.communityId,
      table.userId
    ),
  ]
);

export const communitySubscriptions = pgTable(
  "community_subscriptions",
  {
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currentPeriodEnd: timestamp("current_period_end"),
    id: text("id").primaryKey(),
    status: communitySubscriptionStatusEnum("status")
      .default("pending")
      .notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    index("community_subscriptions_community_id_idx").on(table.communityId),
    uniqueIndex("community_subscriptions_stripe_subscription_id_idx").on(
      table.stripeSubscriptionId
    ),
  ]
);

export const communityPosts = pgTable(
  "community_posts",
  {
    body: text("body"),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    isPinned: boolean("is_pinned").default(false).notNull(),
    mediaUrl: text("media_url"),
    metadata: jsonb("metadata"),
    postType: communityPostTypeEnum("post_type").default("text").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("community_posts_community_id_idx").on(table.communityId)]
);

export const communityMessages = pgTable(
  "community_messages",
  {
    body: text("body").notNull(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("community_messages_community_id_idx").on(table.communityId),
  ]
);
