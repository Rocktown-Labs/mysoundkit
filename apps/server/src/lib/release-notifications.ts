import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  trackPreSaves,
  tracks,
  userNotifications,
} from "@soundkit/db/schema/app";
import { and, eq, isNotNull, lte } from "drizzle-orm";

export const publishDueTrackReleases = async () => {
  if (!isDatabaseConfigured()) {
    return { published: 0, notified: 0 };
  }

  const db = createDb();
  const dueTracks = await db
    .select({ id: tracks.id, title: tracks.title })
    .from(tracks)
    .where(
      and(
        eq(tracks.releaseStrategy, "scheduled"),
        eq(tracks.isPublic, false),
        isNotNull(tracks.releaseAt),
        lte(tracks.releaseAt, new Date())
      )
    );

  let notified = 0;
  for (const track of dueTracks) {
    await db
      .update(tracks)
      .set({ isPublic: true, releaseStrategy: "publish_when_ready" })
      .where(eq(tracks.id, track.id));

    const subscribers = await db
      .select({ userId: trackPreSaves.userId })
      .from(trackPreSaves)
      .where(eq(trackPreSaves.trackId, track.id));

    for (const subscriber of subscribers) {
      const [notification] = await db
        .insert(userNotifications)
        .values({
          id: `track_release:${track.id}:${subscriber.userId}`,
          link: `/tracks/${track.id}`,
          message: `"${track.title}" is now available to listen.`,
          title: "New release available",
          type: "track_release",
          userId: subscriber.userId,
        })
        .onConflictDoNothing()
        .returning({ id: userNotifications.id });
      if (notification) {
        notified += 1;
      }
    }
  }

  return { notified, published: dueTracks.length };
};
