import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  projectPreSaves,
  projects,
  trackPreSaves,
  tracks,
  userFollows,
  userNotifications,
  userProfiles,
  videoPreSaves,
  videos,
} from "@soundkit/db/schema/app";
import { and, eq, isNotNull, lte } from "drizzle-orm";

import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import { notifyArtistReleaseEmail } from "@/lib/email-events";

const loadReleaseAudience = async ({
  ownerUserId,
  preSavedUserIds,
}: {
  ownerUserId: string;
  preSavedUserIds: string[];
}) => {
  const db = createDb(),
    [artistFollowers, profileFollowers] = await Promise.all([
      db
        .select({ userId: artistFollows.followerUserId })
        .from(artistFollows)
        .where(eq(artistFollows.artistUserId, ownerUserId)),
      db
        .select({ userId: userFollows.followerUserId })
        .from(userFollows)
        .where(eq(userFollows.targetUserId, ownerUserId)),
    ]);
  return [
    ...new Set([
      ...preSavedUserIds,
      ...artistFollowers.map((entry) => entry.userId),
      ...profileFollowers.map((entry) => entry.userId),
    ]),
  ].filter((userId) => userId !== ownerUserId);
};

export const publishDueTrackReleases = async ({
  emailQueue,
}: {
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
} = {}) => {
  if (!isDatabaseConfigured()) {
    return { notified: 0, published: 0 };
  }

  const db = createDb(),
    dueTracks = await db
      .select({
        artistName: userProfiles.displayName,
        id: tracks.id,
        ownerUserId: tracks.ownerUserId,
        title: tracks.title,
      })
      .from(tracks)
      .leftJoin(userProfiles, eq(userProfiles.userId, tracks.ownerUserId))
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

    const preSavers = await db
        .select({ userId: trackPreSaves.userId })
        .from(trackPreSaves)
        .where(eq(trackPreSaves.trackId, track.id)),
      subscriberIds = await loadReleaseAudience({
        ownerUserId: track.ownerUserId,
        preSavedUserIds: preSavers.map((entry) => entry.userId),
      });

    for (const subscriberId of subscriberIds) {
      const [notification] = await db
        .insert(userNotifications)
        .values({
          id: `track_release:${track.id}:${subscriberId}`,
          link: `/tracks/${track.id}`,
          message: `"${track.title}" is now available to listen.`,
          title: "New release available",
          type: "track_release",
          userId: subscriberId,
        })
        .onConflictDoNothing()
        .returning({ id: userNotifications.id });
      if (notification) {
        notified += 1;
        await notifyArtistReleaseEmail({
          artistName: track.artistName ?? "An artist you follow",
          contentId: track.id,
          contentTitle: track.title,
          contentType: "track",
          queue: emailQueue,
          recipientUserId: subscriberId,
        });
      }
    }
  }

  const dueProjects = await db
    .select({
      artistName: userProfiles.displayName,
      id: projects.id,
      ownerUserId: projects.ownerUserId,
      title: projects.title,
    })
    .from(projects)
    .leftJoin(userProfiles, eq(userProfiles.userId, projects.ownerUserId))
    .where(
      and(
        eq(projects.status, "scheduled"),
        isNotNull(projects.releaseDate),
        lte(projects.releaseDate, new Date())
      )
    );
  for (const project of dueProjects) {
    await db
      .update(projects)
      .set({ isPublic: true, status: "released" })
      .where(eq(projects.id, project.id));
    const preSavers = await db
        .select({ userId: projectPreSaves.userId })
        .from(projectPreSaves)
        .where(eq(projectPreSaves.projectId, project.id)),
      subscriberIds = await loadReleaseAudience({
        ownerUserId: project.ownerUserId,
        preSavedUserIds: preSavers.map((entry) => entry.userId),
      });
    for (const subscriberId of subscriberIds) {
      const [notification] = await db
        .insert(userNotifications)
        .values({
          id: `project_release:${project.id}:${subscriberId}`,
          link: `/projects/${project.id}`,
          message: `"${project.title}" is now available.`,
          title: "New project available",
          type: "project_release",
          userId: subscriberId,
        })
        .onConflictDoNothing()
        .returning({ id: userNotifications.id });
      if (notification) {
        notified += 1;
        await notifyArtistReleaseEmail({
          artistName: project.artistName ?? "An artist you follow",
          contentId: project.id,
          contentTitle: project.title,
          contentType: "project",
          queue: emailQueue,
          recipientUserId: subscriberId,
        });
      }
    }
  }

  const dueVideos = await db
    .select({
      artistName: userProfiles.displayName,
      id: videos.id,
      ownerUserId: videos.ownerUserId,
      title: videos.title,
    })
    .from(videos)
    .leftJoin(userProfiles, eq(userProfiles.userId, videos.ownerUserId))
    .where(
      and(
        isNotNull(videos.releaseAt),
        lte(videos.releaseAt, new Date()),
        eq(videos.isPublic, false)
      )
    );
  for (const video of dueVideos) {
    await db
      .update(videos)
      .set({ isPublic: true })
      .where(eq(videos.id, video.id));
    const preSavers = await db
        .select({ userId: videoPreSaves.userId })
        .from(videoPreSaves)
        .where(eq(videoPreSaves.videoId, video.id)),
      subscriberIds = await loadReleaseAudience({
        ownerUserId: video.ownerUserId,
        preSavedUserIds: preSavers.map((entry) => entry.userId),
      });
    for (const subscriberId of subscriberIds) {
      const [notification] = await db
        .insert(userNotifications)
        .values({
          id: `video_release:${video.id}:${subscriberId}`,
          link: `/videos/${video.id}`,
          message: `"${video.title}" is now available.`,
          title: "New video available",
          type: "video_release",
          userId: subscriberId,
        })
        .onConflictDoNothing()
        .returning({ id: userNotifications.id });
      if (notification) {
        notified += 1;
        await notifyArtistReleaseEmail({
          artistName: video.artistName ?? "An artist you follow",
          contentId: video.id,
          contentTitle: video.title,
          contentType: "video",
          queue: emailQueue,
          recipientUserId: subscriberId,
        });
      }
    }
  }

  return {
    notified,
    published: dueTracks.length + dueProjects.length + dueVideos.length,
  };
};
