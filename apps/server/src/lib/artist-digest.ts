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
import { logInfo } from "@/middleware/structured-logging";

const BATCH_LIMIT = 100;

/**
 * Weekly artist digest: plays, unique listeners, battles won, sales — one
 * email per opted-in artist. Idempotent per artist per period start.
 */
export const runArtistDigest = async ({
  emailQueue,
  now = new Date(),
}: {
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  now?: Date;
} = {}): Promise<{ emailsSent: number; skipped: boolean }> => {
  if (!isDatabaseConfigured()) {
    return { emailsSent: 0, skipped: true };
  }

  const db = createDb(),
    weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
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
          gte(playbackSessions.createdAt, weekStart)
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
      body: `Last week: ${plays} play${plays === 1 ? "" : "s"} from ${
        Number(row.uniqueListeners ?? 0) || "your"
      } listener${Number(row.uniqueListeners) === 1 ? "" : "s"}, ${battlesFought} battle${battlesFought === 1 ? "" : "s"}, and $${(moneyCents / 100).toFixed(2)} in sales.`,
      ctaLabel: "Open dashboard",
      eyebrow: "Weekly digest",
      footerNote:
        "Weekly digests are on by default; manage them in notification settings.",
      heading: "Your week on SoundKit",
      idempotencyKey: `artist-digest/${row.artistUserId}/${weekStart.toISOString().slice(0, 10)}`,
      preference: "sales",
      previewText: `${plays} plays and more from last week.`,
      queue: emailQueue,
      recipient,
      subject: `Your week on SoundKit: ${plays} plays`,
      template: "artist_weekly_digest",
    });

    if (outcome.enqueued) {
      emailsSent += 1;
    }
  }

  logInfo({ emailsSent, event: "artist_digest_sent" });

  return { emailsSent, skipped: false };
};
