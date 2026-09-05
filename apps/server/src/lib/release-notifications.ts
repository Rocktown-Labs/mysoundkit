/* eslint-disable complexity, unicorn/max-nested-calls, sort-vars, one-var, no-nested-ternary, unicorn/no-nested-ternary, unicorn/no-await-expression-member, unicorn/no-negated-condition, unicorn/prefer-number-properties, unicorn/prefer-ternary, no-shadow */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  projectAssets,
  projectPreSaves,
  projects,
  projectTracks,
  trackAssets,
  trackPreSaves,
  tracks,
  userFollows,
  userProfiles,
  videoPreSaves,
  videos,
} from "@soundkit/db/schema/app";
import { and, eq, inArray, isNotNull, isNull, lte } from "drizzle-orm";

import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import { notify } from "@/lib/notifications";
import {
  notifyBioLinkAvailable,
  notifyTrackLive,
  notifyTrackMediaReady,
} from "@/lib/track-notifications";

const PROJECT_MIN_TRACK_COUNT = {
  album: 2,
  ep: 2,
  mixtape: 2,
  single: 1,
} as const;

export interface ProjectReleaseReadiness {
  isReady: boolean;
  missing: string[];
  projectId: string;
  trackIds: string[];
}

export const getProjectReleaseReadiness = async ({
  projectId,
}: {
  projectId: string;
}): Promise<ProjectReleaseReadiness> => {
  if (!isDatabaseConfigured()) {
    return {
      isReady: false,
      missing: ["Database is not configured."],
      projectId,
      trackIds: [],
    };
  }

  const db = createDb(),
    [project] = await db
      .select({ id: projects.id, projectType: projects.projectType })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

  if (!project) {
    return {
      isReady: false,
      missing: ["Project not found."],
      projectId,
      trackIds: [],
    };
  }

  const [coverAsset, trackRows] = await Promise.all([
    db
      .select({ id: projectAssets.id })
      .from(projectAssets)
      .where(
        and(
          eq(projectAssets.projectId, projectId),
          eq(projectAssets.assetKind, "cover_art"),
          inArray(projectAssets.status, ["uploaded", "ready"]),
          isNotNull(projectAssets.objectKey)
        )
      )
      .limit(1),
    db
      .select({
        assetKind: trackAssets.assetKind,
        isCurrent: trackAssets.isCurrent,
        purpose: trackAssets.purpose,
        status: trackAssets.status,
        trackId: projectTracks.trackId,
      })
      .from(projectTracks)
      .leftJoin(trackAssets, eq(trackAssets.trackId, projectTracks.trackId))
      .where(eq(projectTracks.projectId, projectId)),
  ]);

  const trackIds = [
      ...new Set(
        trackRows
          .map((row) => row.trackId)
          .filter((trackId): trackId is string => Boolean(trackId))
      ),
    ],
    hasReadyStreamingByTrack = new Map<string, boolean>(),
    hasMasterByTrack = new Map<string, boolean>();

  for (const row of trackRows) {
    if (!row.trackId) {
      continue;
    }

    if (
      row.purpose === "streaming" &&
      row.isCurrent &&
      row.status === "ready"
    ) {
      hasReadyStreamingByTrack.set(row.trackId, true);
    }
    if (
      (row.purpose === "master" || row.assetKind === "master") &&
      row.isCurrent &&
      row.status !== null &&
      ["uploaded", "ready"].includes(row.status)
    ) {
      hasMasterByTrack.set(row.trackId, true);
    }
  }

  const missing = [];
  if (coverAsset.length === 0) {
    missing.push("Cover artwork is required.");
  }
  if (trackIds.length < PROJECT_MIN_TRACK_COUNT[project.projectType]) {
    missing.push(
      `${project.projectType === "single" ? "A single needs" : "This project needs"} at least ${PROJECT_MIN_TRACK_COUNT[project.projectType]} final master${PROJECT_MIN_TRACK_COUNT[project.projectType] === 1 ? "" : "s"}.`
    );
  }
  if (trackIds.some((trackId) => !hasMasterByTrack.get(trackId))) {
    missing.push("Every project track needs a final master.");
  }
  if (trackIds.some((trackId) => !hasReadyStreamingByTrack.get(trackId))) {
    missing.push("Every final master needs a ready streaming version.");
  }

  return { isReady: missing.length === 0, missing, projectId, trackIds };
};

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

export const publishProjectIfMediaReady = async ({
  projectId,
}: {
  projectId: string;
}) => {
  if (!isDatabaseConfigured()) {
    return false;
  }

  const db = createDb(),
    [project] = await db
      .select({
        id: projects.id,
        isPublic: projects.isPublic,
        releaseDate: projects.releaseDate,
        status: projects.status,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
  if (!project) {
    return false;
  }
  if (project.isPublic) {
    return true;
  }

  const releaseIsDue =
    !project.releaseDate || project.releaseDate.getTime() <= Date.now();
  if (
    (project.status !== "released" && project.status !== "scheduled") ||
    !releaseIsDue
  ) {
    return false;
  }

  const readiness = await getProjectReleaseReadiness({ projectId });
  if (!readiness.isReady) {
    return false;
  }

  const now = new Date();
  await db.transaction(async (transaction) => {
    await transaction
      .update(projects)
      .set({ isPublic: true, status: "released", updatedAt: now })
      .where(eq(projects.id, projectId));
    await transaction
      .update(tracks)
      .set({
        isPublic: true,
        publishedAt: now,
        releaseStrategy: "publish_when_ready",
        updatedAt: now,
      })
      .where(inArray(tracks.id, readiness.trackIds));
  });
  return true;
};

const publishReadyProjectsContainingTrack = async (trackId: string) => {
  if (!isDatabaseConfigured()) {
    return;
  }
  const projectRows = await createDb()
    .select({ projectId: projectTracks.projectId })
    .from(projectTracks)
    .where(eq(projectTracks.trackId, trackId));
  for (const projectRow of projectRows) {
    await publishProjectIfMediaReady({ projectId: projectRow.projectId });
  }
};

export const handleTrackMediaReady = async ({
  emailQueue,
  trackId,
}: {
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  trackId: string;
}) => {
  if (!isDatabaseConfigured()) {
    return { mediaReady: false, published: false };
  }

  const db = createDb(),
    [track] = await db
      .select({
        id: tracks.id,
        isPublic: tracks.isPublic,
        releaseAt: tracks.releaseAt,
        releaseStrategy: tracks.releaseStrategy,
      })
      .from(tracks)
      .where(eq(tracks.id, trackId))
      .limit(1);
  if (!track) {
    return { mediaReady: false, published: false };
  }

  await notifyTrackMediaReady({ emailQueue, trackId });
  await notifyBioLinkAvailable({ emailQueue, trackId });

  const releaseIsDue =
      !track.releaseAt || track.releaseAt.getTime() <= Date.now(),
    shouldPublish =
      track.releaseStrategy !== "private" && releaseIsDue && !track.isPublic;
  if (shouldPublish) {
    await db
      .update(tracks)
      .set({
        isPublic: true,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tracks.id, trackId));
    await notifyTrackLive({ emailQueue, trackId });
  }
  await publishReadyProjectsContainingTrack(trackId);

  return { mediaReady: true, published: track.isPublic || shouldPublish };
};

export const publishDueTrackReleases = async ({
  emailQueue,
}: {
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
} = {}) => {
  if (!isDatabaseConfigured()) {
    return { notified: 0, published: 0 };
  }

  const db = createDb();

  await db
    .update(tracks)
    .set({
      publishedAt: tracks.createdAt,
      updatedAt: new Date(),
    })
    .where(and(eq(tracks.isPublic, true), isNull(tracks.publishedAt)));

  const dueTracks = await db
    .select({
      artistName: userProfiles.displayName,
      id: tracks.id,
      ownerUserId: tracks.ownerUserId,
      title: tracks.title,
    })
    .from(tracks)
    .innerJoin(
      trackAssets,
      and(
        eq(trackAssets.trackId, tracks.id),
        eq(trackAssets.purpose, "streaming"),
        eq(trackAssets.isCurrent, true),
        eq(trackAssets.status, "ready")
      )
    )
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
    await notifyTrackLive({ emailQueue, trackId: track.id });

    const preSavers = await db
        .select({ userId: trackPreSaves.userId })
        .from(trackPreSaves)
        .where(eq(trackPreSaves.trackId, track.id)),
      subscriberIds = await loadReleaseAudience({
        ownerUserId: track.ownerUserId,
        preSavedUserIds: preSavers.map((entry) => entry.userId),
      });

    for (const subscriberId of subscriberIds) {
      const result = await notify(
        {
          actorUserId: track.ownerUserId,
          aggregationKey: `releases:${track.ownerUserId}`,
          data: {
            artistName: track.artistName ?? "An artist you follow",
            contentId: track.id,
            contentTitle: track.title,
            contentType: "track",
          },
          entity: { id: track.id, type: "track" },
          eventId: track.id,
          recipientUserId: subscriberId,
          type: "artist.release",
        },
        { emailQueue }
      );
      if (result.inApp === "created") {
        notified += 1;
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
  let publishedProjects = 0;
  for (const project of dueProjects) {
    const published = await publishProjectIfMediaReady({
      projectId: project.id,
    });
    if (!published) {
      continue;
    }
    publishedProjects += 1;
    const preSavers = await db
        .select({ userId: projectPreSaves.userId })
        .from(projectPreSaves)
        .where(eq(projectPreSaves.projectId, project.id)),
      subscriberIds = await loadReleaseAudience({
        ownerUserId: project.ownerUserId,
        preSavedUserIds: preSavers.map((entry) => entry.userId),
      });
    for (const subscriberId of subscriberIds) {
      const result = await notify(
        {
          actorUserId: project.ownerUserId,
          aggregationKey: `releases:${project.ownerUserId}`,
          data: {
            artistName: project.artistName ?? "An artist you follow",
            contentId: project.id,
            contentTitle: project.title,
            contentType: "project",
          },
          entity: { id: project.id, type: "project" },
          eventId: project.id,
          recipientUserId: subscriberId,
          type: "artist.release",
        },
        { emailQueue }
      );
      if (result.inApp === "created") {
        notified += 1;
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
      const result = await notify(
        {
          actorUserId: video.ownerUserId,
          aggregationKey: `releases:${video.ownerUserId}`,
          data: {
            artistName: video.artistName ?? "An artist you follow",
            contentId: video.id,
            contentTitle: video.title,
            contentType: "video",
          },
          entity: { id: video.id, type: "video" },
          eventId: video.id,
          recipientUserId: subscriberId,
          type: "artist.release",
        },
        { emailQueue }
      );
      if (result.inApp === "created") {
        notified += 1;
      }
    }
  }

  return {
    notified,
    published: dueTracks.length + publishedProjects + dueVideos.length,
  };
};
