import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  notificationSettings,
  tracks,
  userNotifications,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { eq } from "drizzle-orm";

import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import { enqueueTransactionalEmail } from "@/lib/email-delivery";

const trackDashboardLink = (trackId: string) => `/dashboard/tracks/${trackId}`,
  loadTrackForNotification = async (trackId: string) => {
    if (!isDatabaseConfigured()) {
      return null;
    }

    const db = createDb(),
      [track] = await db
        .select({
          email: authUser.email,
          id: tracks.id,
          name: authUser.name,
          ownerUserId: tracks.ownerUserId,
          title: tracks.title,
        })
        .from(tracks)
        .innerJoin(authUser, eq(authUser.id, tracks.ownerUserId))
        .where(eq(tracks.id, trackId))
        .limit(1);

    return track ?? null;
  },
  shouldSendTrackProcessingEmail = async (userId: string) => {
    if (!isDatabaseConfigured()) {
      return false;
    }

    const [settings] = await createDb()
      .select({
        emailTrackProcessing: notificationSettings.emailTrackProcessing,
      })
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId))
      .limit(1);

    return settings?.emailTrackProcessing ?? true;
  };

export const notifyTrackLive = async ({
  emailQueue,
  trackId,
}: {
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  trackId: string;
}) => {
  const track = await loadTrackForNotification(trackId);

  if (!track?.ownerUserId) {
    return { notified: false, reason: "track_not_found" as const };
  }

  const [notification] = await createDb()
    .insert(userNotifications)
    .values({
      id: `track_live:${track.id}`,
      link: trackDashboardLink(track.id),
      message: `"${track.title}" is ready with its audio, cover art, duration, and release details.`,
      title: "Your track is ready",
      type: "track_ready",
      userId: track.ownerUserId,
    })
    .onConflictDoNothing()
    .returning({ id: userNotifications.id });

  if (
    notification &&
    (await shouldSendTrackProcessingEmail(track.ownerUserId))
  ) {
    await enqueueTransactionalEmail({
      actionPath: trackDashboardLink(track.id),
      idempotencyKey: `track-ready/${track.id}`,
      payload: {
        trackId: track.id,
        trackTitle: track.title,
      },
      queue: emailQueue,
      recipientEmail: track.email,
      recipientName: track.name ?? "there",
      template: "track_ready",
      userId: track.ownerUserId,
    });
  }

  return { notified: true, reason: "created_or_existing" as const };
};

export const notifyTrackProcessingComplete = async ({
  emailQueue,
  trackId,
}: {
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  trackId: string;
}) => {
  const track = await loadTrackForNotification(trackId);

  if (!track?.ownerUserId) {
    return { notified: false, reason: "track_not_found" as const };
  }

  const [notification] = await createDb()
    .insert(userNotifications)
    .values({
      id: `track_processing_complete:${track.id}`,
      link: trackDashboardLink(track.id),
      message: `"${track.title}" has new track details ready to review, including lyric timing where available.`,
      title: "Track details ready",
      type: "track_processing_complete",
      userId: track.ownerUserId,
    })
    .onConflictDoNothing()
    .returning({ id: userNotifications.id });

  if (
    notification &&
    (await shouldSendTrackProcessingEmail(track.ownerUserId))
  ) {
    await enqueueTransactionalEmail({
      actionPath: trackDashboardLink(track.id),
      idempotencyKey: `track-processing-ready/${track.id}`,
      payload: {
        trackId: track.id,
        trackTitle: track.title,
      },
      queue: emailQueue,
      recipientEmail: track.email,
      recipientName: track.name ?? "there",
      template: "track_processing_ready",
      userId: track.ownerUserId,
    });
  }

  return { notified: true, reason: "created_or_existing" as const };
};
