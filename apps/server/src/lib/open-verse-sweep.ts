/* eslint-disable one-var */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  openVerseListings,
  openVerseSubmissions,
  tracks,
  userNotifications,
} from "@soundkit/db/schema/app";
import { and, eq, gt, isNotNull, lte } from "drizzle-orm";

import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import {
  collaborationFooter,
  enqueueForRecipient,
  getUserRecipient,
} from "@/lib/email-events";

const CLOSE_SWEEP_LIMIT = 50,
  CLOSING_SOON_HORIZON_MS = 24 * 60 * 60 * 1000;

interface OpenVerseSweepResult {
  closed: number;
  reminders: number;
  skipped: boolean;
}

export const runOpenVerseSweep = async ({
  emailQueue,
  now = new Date(),
}: {
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  now?: Date;
}): Promise<OpenVerseSweepResult> => {
  if (!isDatabaseConfigured()) {
    return { closed: 0, reminders: 0, skipped: true };
  }

  const db = createDb(),
    closingSoonHorizon = new Date(now.getTime() + CLOSING_SOON_HORIZON_MS),
    [dueListings, soonClosingListings] = await Promise.all([
      db
        .select({
          closesAt: openVerseListings.closesAt,
          id: openVerseListings.id,
          ownerUserId: openVerseListings.ownerUserId,
          trackId: openVerseListings.trackId,
          trackTitle: tracks.title,
        })
        .from(openVerseListings)
        .innerJoin(tracks, eq(tracks.id, openVerseListings.trackId))
        .where(
          and(
            eq(openVerseListings.status, "open"),
            isNotNull(openVerseListings.closesAt),
            lte(openVerseListings.closesAt, now)
          )
        )
        .limit(CLOSE_SWEEP_LIMIT),
      db
        .select({
          closesAt: openVerseListings.closesAt,
          id: openVerseListings.id,
          ownerUserId: openVerseListings.ownerUserId,
          trackTitle: tracks.title,
        })
        .from(openVerseListings)
        .innerJoin(tracks, eq(tracks.id, openVerseListings.trackId))
        .where(
          and(
            eq(openVerseListings.status, "open"),
            isNotNull(openVerseListings.closesAt),
            gt(openVerseListings.closesAt, now),
            lte(openVerseListings.closesAt, closingSoonHorizon)
          )
        )
        .limit(CLOSE_SWEEP_LIMIT),
    ]);

  let closed = 0,
    reminders = 0;

  for (const listing of dueListings) {
    const [updated] = await db
      .update(openVerseListings)
      .set({ status: "closed", updatedAt: now })
      .where(
        and(
          eq(openVerseListings.id, listing.id),
          eq(openVerseListings.status, "open")
        )
      )
      .returning({ id: openVerseListings.id });

    if (!updated) {
      continue;
    }
    closed += 1;

    const submitterRows = await db
      .selectDistinct({ submitterUserId: openVerseSubmissions.submitterUserId })
      .from(openVerseSubmissions)
      .where(eq(openVerseSubmissions.listingId, listing.id));

    const recipientUserIds = [
      ...new Set([
        listing.ownerUserId,
        ...submitterRows.map((r) => r.submitterUserId),
      ]),
    ];

    await db
      .insert(userNotifications)
      .values(
        recipientUserIds.map((userId) => ({
          id: `open_verse_closed:${listing.id}:${userId}`,
          link: `/dashboard/open-verses`,
          message: `Submissions are closed for ${listing.trackTitle}. Time to review and pick a winner.`,
          title: "Open Verse Closed",
          type: "open_verse_closed",
          userId,
        }))
      )
      .onConflictDoNothing();

    for (const userId of recipientUserIds) {
      const recipient = await getUserRecipient(userId);
      if (!recipient) {
        continue;
      }
      await enqueueForRecipient({
        actionPath: "/dashboard/open-verses",
        body: `Submissions for ${listing.trackTitle} are now closed. Review the verses you received and accept the one that fits the track.`,
        ctaLabel: "Review submissions",
        eyebrow: "Open verse",
        footerNote: collaborationFooter,
        heading: `${listing.trackTitle} closed for submissions`,
        idempotencyKey: `open-verse-closed/${listing.id}/${userId}`,
        preference: "collaborations",
        previewText: `${listing.trackTitle} is closed for submissions.`,
        queue: emailQueue,
        recipient,
        subject: `${listing.trackTitle} closed for submissions`,
        template: "open_verse_closed",
      });
    }
  }

  for (const listing of soonClosingListings) {
    const ownerRecipient = await getUserRecipient(listing.ownerUserId);
    if (!ownerRecipient) {
      continue;
    }

    const outcome = await enqueueForRecipient({
      actionPath: "/dashboard/open-verses",
      body: `${listing.trackTitle} stops accepting submissions at ${listing.closesAt?.toISOString() ?? "its deadline"}. Share it one more time or close it early.`,
      ctaLabel: "Open listing",
      eyebrow: "Open verse",
      footerNote: collaborationFooter,
      heading: `${listing.trackTitle} closes in 24 hours`,
      idempotencyKey: `open-verse-closing/${listing.id}`,
      preference: "collaborations",
      previewText: `${listing.trackTitle} closes in 24 hours.`,
      queue: emailQueue,
      recipient: ownerRecipient,
      subject: `${listing.trackTitle} closes in 24 hours`,
      template: "open_verse_closing",
    });

    if (outcome.enqueued) {
      reminders += 1;
    }
  }

  return { closed, reminders, skipped: false };
};
