import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  notificationSettings,
  tracks,
  userNotifications,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { eq } from "drizzle-orm";

import { sendTrackLifecycleEmail } from "@/lib/email";

const trackDashboardLink = (trackId: string) => `/dashboard/tracks/${trackId}`;

const loadTrackForNotification = async (trackId: string) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = createDb();
  const [track] = await db
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
};

const shouldSendTrackProcessingEmail = async (userId: string) => {
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

export const notifyTrackLive = async ({ trackId }: { trackId: string }) => {
  const track = await loadTrackForNotification(trackId);

  if (!track?.ownerUserId) {
    return { notified: false, reason: "track_not_found" as const };
  }

  const [notification] = await createDb()
    .insert(userNotifications)
    .values({
      id: `track_live:${track.id}`,
      link: trackDashboardLink(track.id),
      message: `"${track.title}" has settled with its audio and cover art and is now live on SoundKit.`,
      title: "Your track is live",
      type: "track_live",
      userId: track.ownerUserId,
    })
    .onConflictDoNothing()
    .returning({ id: userNotifications.id });

  if (
    notification &&
    (await shouldSendTrackProcessingEmail(track.ownerUserId))
  ) {
    await sendTrackLifecycleEmail({
      idempotencyKey: `track-live/${track.id}`,
      recipientEmail: track.email,
      recipientName: track.name,
      trackId: track.id,
      trackTitle: track.title,
    });
  }

  return { notified: true, reason: "created_or_existing" as const };
};

export const notifyTrackProcessingComplete = async ({
  trackId,
}: {
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
      message: `"${track.title}" finished premium audio processing. Stems, BPM details, and lyric timing are ready to review.`,
      title: "Premium processing complete",
      type: "track_processing_complete",
      userId: track.ownerUserId,
    })
    .onConflictDoNothing()
    .returning({ id: userNotifications.id });

  if (
    notification &&
    (await shouldSendTrackProcessingEmail(track.ownerUserId))
  ) {
    await sendTrackLifecycleEmail({
      idempotencyKey: `track-processing-complete/${track.id}`,
      processingComplete: true,
      recipientEmail: track.email,
      recipientName: track.name,
      trackId: track.id,
      trackTitle: track.title,
    });
  }

  return { notified: true, reason: "created_or_existing" as const };
};
