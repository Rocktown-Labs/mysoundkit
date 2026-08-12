import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  projectPreSaves,
  projects,
  trackPreSaves,
  tracks,
  userNotifications,
  videoPreSaves,
  videos,
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

  const dueProjects = await db
    .select({ id: projects.id, title: projects.title })
    .from(projects)
    .where(
      and(
        eq(projects.status, "scheduled"),
        isNotNull(projects.releaseDate),
        lte(projects.releaseDate, new Date())
      )
    );
  for (const project of dueProjects) {
    await db.update(projects).set({ status: "released", isPublic: true }).where(eq(projects.id, project.id));
    const subscribers = await db.select({ userId: projectPreSaves.userId }).from(projectPreSaves).where(eq(projectPreSaves.projectId, project.id));
    for (const subscriber of subscribers) {
      await db.insert(userNotifications).values({
        id: `project_release:${project.id}:${subscriber.userId}`,
        link: `/projects/${project.id}`,
        message: `"${project.title}" is now available.`,
        title: "New project available",
        type: "project_release",
        userId: subscriber.userId,
      }).onConflictDoNothing();
      notified += 1;
    }
  }

  const dueVideos = await db
    .select({ id: videos.id, title: videos.title })
    .from(videos)
    .where(and(isNotNull(videos.releaseAt), lte(videos.releaseAt, new Date()), eq(videos.isPublic, false)));
  for (const video of dueVideos) {
    await db.update(videos).set({ isPublic: true }).where(eq(videos.id, video.id));
    const subscribers = await db.select({ userId: videoPreSaves.userId }).from(videoPreSaves).where(eq(videoPreSaves.videoId, video.id));
    for (const subscriber of subscribers) {
      await db.insert(userNotifications).values({
        id: `video_release:${video.id}:${subscriber.userId}`,
        link: `/videos/${video.id}`,
        message: `"${video.title}" is now available.`,
        title: "New video available",
        type: "video_release",
        userId: subscriber.userId,
      }).onConflictDoNothing();
      notified += 1;
    }
  }

  return { notified, published: dueTracks.length + dueProjects.length + dueVideos.length };
};
