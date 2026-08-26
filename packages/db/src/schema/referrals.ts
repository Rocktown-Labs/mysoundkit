import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const platformInviteStatusEnum = pgEnum("platform_invite_status", [
  "pending",
  "sent",
  "failed",
]);

export const platformInvites = pgTable(
  "platform_invites",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    email: text("email").notNull(),
    id: text("id").primaryKey(),
    inviterUserId: text("inviter_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastAttemptAt: timestamp("last_attempt_at"),
    sentAt: timestamp("sent_at"),
    status: platformInviteStatusEnum("status").default("pending").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("platform_invites_inviter_created_idx").on(
      table.inviterUserId,
      table.createdAt
    ),
    uniqueIndex("platform_invites_inviter_email_idx").on(
      table.inviterUserId,
      table.email
    ),
  ]
);
