/* eslint-disable one-var */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  battles,
  orderItems,
  orders,
  playbackSessions,
  tracks,
} from "@soundkit/db/schema/app";
import { and, countDistinct, eq, gte, sql } from "drizzle-orm";

import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import { enqueueForRecipient, getUserRecipient } from "@/lib/email-events";
import { playConditionSql } from "@/lib/analytics-helpers";
import { logInfo } from "@/middleware/structured-logging";

const BATCH_LIMIT = 100;

const cadenceWindow = (cadence: "monthly" | "weekly", now: Date) => {
    if (cadence === "monthly") {
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    }

    // Weekly periods are Monday-anchored (Mon..Sun, Sunday = day 7): on a
    // Monday send, the window opens at the PREVIOUS Monday so the email
    // covers the completed week.
    const day = now.getUTCDay(),
      daysSinceMonday = (day + 6) % 7,
      monday = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - daysSinceMonday
        )
      );

    return daysSinceMonday === 0
      ? new Date(monday.getTime() - 7 * 24 * 60 * 60 * 1000)
      : monday;
  };

export const isDigestSendDay = (cadence: "monthly" | "weekly", now: Date) =>
  cadence === "monthly"
    ? now.getUTCDate() <= 3
    : now.getUTCDay() === 1;

/**
 * Artist digest (weekly or monthly): plays, unique listeners, battles
 * fought, and sales — one email per opted-in artist. Idempotent per artist
 * per period.
 */
export const runArtistDigest = async ({
  cadence = "weekly",
  emailQueue,
  now = new Date(),
}: {
  cadence?: "monthly" | "weekly";
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  now?: Date;
} = {}): Promise<{ emailsSent: number; skipped: boolean }> => {
  if (!isDatabaseConfigured()) {
    return { emailsSent: 0, skipped: true };
  }

  const db = createDb(),
    weekStart = cadenceWindow(cadence, now),
    periodLabel = cadence === "monthly" ? "month" : "week",
    artistRows = await db
      .select({
        artistUserId: tracks.ownerUserId,
        plays: sql<number>`count(*)::int`,
        trackTitle: sql<string>`max(${tracks.title})`,
        uniqueListeners: countDistinct(playbackSessions.userId),
      })
      .from(tracks)
      .leftJoin(
        playbackSessions,
        and(
          eq(playbackSessions.trackId, tracks.id),
          gte(playbackSessions.createdAt, weekStart),
          playConditionSql
        )
      )
      .where(eq(tracks.isPublic, true))
      .groupBy(tracks.ownerUserId)
      .limit(BATCH_LIMIT);

  let emailsSent = 0;

  for (const row of artistRows) {
    const recipient = await getUserRecipient(row.artistUserId);
    if (!recipient) {
      continue;
    }

    // NOTE: no persisted winner column yet — count battles participated.
    const [battleRows] = await db
        .select({ fights: sql<number>`count(*)::int` })
        .from(battles)
        .where(
          and(
            gte(battles.endedAt, weekStart),
            sql`${battles.challengerArtistUserId} = ${row.artistUserId} or ${battles.opponentArtistUserId} = ${row.artistUserId}`
          )
        ),
      [salesRow] = await db
        .select({
          moneyCents: sql<number>`coalesce(sum(${orderItems.priceSnapshot} * ${orderItems.quantity} * 100), 0)::int`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .innerJoin(tracks, eq(tracks.id, orderItems.trackId))
        .where(
          and(
            eq(tracks.ownerUserId, row.artistUserId),
            eq(orders.status, "paid"),
            gte(orders.createdAt, weekStart)
          )
        );

    // Skip artists with a fully quiet week to keep the email valuable.
    const plays = Number(row.plays ?? 0),
      battlesFought = Number(battleRows?.fights ?? 0),
      moneyCents = Number(salesRow?.moneyCents ?? 0);
    if (plays === 0 && battlesFought === 0 && moneyCents === 0) {
      continue;
    }

    const outcome = await enqueueForRecipient({
      actionPath: "/dashboard",
      body: `Last ${periodLabel}: ${plays} play${plays === 1 ? "" : "s"} from ${
        Number(row.uniqueListeners ?? 0) || "your"
      } listener${Number(row.uniqueListeners) === 1 ? "" : "s"}, ${battlesFought} battle${battlesFought === 1 ? "" : "s"}, and $${(moneyCents / 100).toFixed(2)} in sales.`,
      ctaLabel: "Open dashboard",
      eyebrow: cadence === "monthly" ? "Monthly digest" : "Weekly digest",
      footerNote:
        "Digests are on by default; manage them in notification settings.",
      heading: `Your ${periodLabel} on SoundKit`,
      idempotencyKey: `artist-digest-${cadence}/${row.artistUserId}/${weekStart.toISOString().slice(0, 10)}`,
      preference: "sales",
      previewText: `${plays} plays and more from your last ${periodLabel}.`,
      queue: emailQueue,
      recipient,
      subject: `Your ${periodLabel} on SoundKit: ${plays} play${plays === 1 ? "" : "s"}`,
      template: cadence === "monthly" ? "artist_monthly_digest" : "artist_weekly_digest",
    });

    if (outcome.enqueued) {
      emailsSent += 1;
    }
  }

  logInfo({ emailsSent, event: "artist_digest_sent" });

  return { emailsSent, skipped: false };
};

/**
 * Fan digest: listening recap — tracks played, artists discovered, minutes
 * and purchases in the window. Skips quiet fans.
 */
export const runFanDigest = async ({
  cadence = "weekly",
  emailQueue,
  now = new Date(),
}: {
  cadence?: "monthly" | "weekly";
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  now?: Date;
} = {}): Promise<{ emailsSent: number; skipped: boolean }> => {
  if (!isDatabaseConfigured()) {
    return { emailsSent: 0, skipped: true };
  }

  const db = createDb(),
    periodStart = cadenceWindow(cadence, now),
    fanRows = await db
      .select({
        listeners: countDistinct(playbackSessions.userId),
        plays: sql<number>`count(*)::int`,
        trackCount: sql<number>`count(distinct ${playbackSessions.trackId})::int`,
        userId: playbackSessions.userId,
      })
      .from(playbackSessions)
      .where(
        and(gte(playbackSessions.createdAt, periodStart), playConditionSql)
      )
      .groupBy(playbackSessions.userId)
      .limit(BATCH_LIMIT);

  let emailsSent = 0;

  for (const row of fanRows) {
    if (!row.userId) {
      continue;
    }

    const recipient = await getUserRecipient(row.userId);
    if (!recipient) {
      continue;
    }

    const [purchaseRow] = await db
      .select({
        moneyCents:
          sql<number>`coalesce(sum(${orderItems.priceSnapshot} * ${orderItems.quantity} * 100), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(eq(orders.buyerUserId, row.userId), gte(orders.createdAt, periodStart))
      );

    const purchasesCents = Number(purchaseRow?.moneyCents ?? 0),
      plays = Number(row.plays ?? 0),
      trackCount = Number(row.trackCount ?? 0);
    if (plays === 0 && purchasesCents === 0) {
      continue;
    }

    const outcome = await enqueueForRecipient({
      actionPath: "/library",
      body: `You streamed ${plays} play${plays === 1 ? "" : "s"} across ${trackCount} track${trackCount === 1 ? "" : "s"} this ${cadence === "monthly" ? "month" : "week"}${
        purchasesCents > 0
          ? ` and picked up $${(purchasesCents / 100).toFixed(2)} of music to keep forever`
          : ""
      }. Your library is ready when you are.`,
      ctaLabel: "Open your library",
      eyebrow: cadence === "monthly" ? "Monthly recap" : "Weekly recap",
      footerNote:
        "Recaps are on by default; manage them in notification settings.",
      heading: "Your SoundKit listening recap",
      idempotencyKey: `fan-digest-${cadence}/${row.userId}/${periodStart.toISOString().slice(0, 10)}`,
      preference: "sales",
      previewText: `${plays} play${plays === 1 ? "" : "s"} of ${trackCount} track${trackCount === 1 ? "" : "s"} this ${cadence}.`,
      queue: emailQueue,
      recipient,
      subject: `Your ${cadence} listening recap: ${plays} play${plays === 1 ? "" : "s"}, ${trackCount} track${trackCount === 1 ? "" : "s"}`,
      template: "fan_digest",
    });

    if (outcome.enqueued) {
      emailsSent += 1;
    }
  }

  return { emailsSent, skipped: false };
};
