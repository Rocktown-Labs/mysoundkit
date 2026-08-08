import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { tracks, userNotifications } from "@soundkit/db/schema/app";
import { eq } from "drizzle-orm";

const trackDashboardLink = (trackId: string) => `/dashboard/tracks/${trackId}`;

const loadTrackForNotification = async (trackId: string) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = createDb();
  const [track] = await db
    .select({
      id: tracks.id,
      ownerUserId: tracks.ownerUserId,
      title: tracks.title,
    })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);

  return track ?? null;
};

export const notifyTrackLive = async ({ trackId }: { trackId: string }) => {
  const track = await loadTrackForNotification(trackId);

  if (!track?.ownerUserId) {
    return { notified: false, reason: "track_not_found" as const };
  }

  await createDb()
    .insert(userNotifications)
    .values({
      id: `track_live:${track.id}`,
      link: trackDashboardLink(track.id),
      message: `"${track.title}" has settled with its audio and cover art and is now live on SoundKit.`,
      title: "Your track is live",
      type: "track_live",
      userId: track.ownerUserId,
    })
    .onConflictDoNothing();

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

  await createDb()
    .insert(userNotifications)
    .values({
      id: `track_processing_complete:${track.id}`,
      link: trackDashboardLink(track.id),
      message: `"${track.title}" finished premium audio processing. Stems, BPM details, and lyric timing are ready to review.`,
      title: "Premium processing complete",
      type: "track_processing_complete",
      userId: track.ownerUserId,
    })
    .onConflictDoNothing();

  return { notified: true, reason: "created_or_existing" as const };
};
