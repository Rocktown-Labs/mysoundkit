import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  battleRounds,
  battles,
  battleStats,
  liveExperiences,
  tracks,
  userNotifications,
  videos,
  workflowJobs,
} from "@soundkit/db/schema/app";
import { member, subscription } from "@soundkit/db/schema/auth";
import { env } from "@soundkit/env/server";
import { and, asc, eq, inArray, lte, or } from "drizzle-orm";

import type { LiveExperienceKind } from "@/lib/live-experience";
import type { LiveNotificationQueueMessage } from "@/lib/live-notifications";
import { logWarn } from "@/middleware/structured-logging";

export const BATTLE_RECORD_THRESHOLD_VIEWERS = 10;

export const REALTIMEKIT_WEBHOOK_PUBLIC_KEY_URL =
  "https://api.realtime.cloudflare.com/.well-known/webhooks.json";

const base64UrlToBytes = (value: string) => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/"),
    padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );

  return Uint8Array.from(atob(padded), (char) => char.codePointAt(0) ?? 0);
};

export const verifyRealtimeKitSignature = async ({
  body,
  publicKeyPem,
  signature,
}: {
  body: BufferSource;
  publicKeyPem: string;
  signature: string;
}) => {
  const cleanPem = publicKeyPem
      .replaceAll("\\n", "")
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "")
      .replaceAll(/\s+/gu, ""),
    publicKey = await crypto.subtle.importKey(
      "spki",
      base64UrlToBytes(cleanPem),
      { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
      false,
      ["verify"]
    );

  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    base64UrlToBytes(signature),
    body
  );
};

export const fetchRealtimeKitWebhookPublicKey = async (
  publicKeyUrl?: string
) => {
  const url = publicKeyUrl || REALTIMEKIT_WEBHOOK_PUBLIC_KEY_URL,
    response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as {
    data?: { publicKey?: string };
  };

  return body.data?.publicKey ?? null;
};

export interface RealtimeKitWebhookEnvelope {
  event: string;
  [key: string]: unknown;
}

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

export const loadLiveExperienceByMeetingId = async (meetingId: string) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const [experience] = await createDb()
    .select()
    .from(liveExperiences)
    .where(eq(liveExperiences.meetingId, meetingId))
    .limit(1);

  return experience ?? null;
};

export const loadLiveExperienceById = async (experienceId: string) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const [experience] = await createDb()
    .select()
    .from(liveExperiences)
    .where(eq(liveExperiences.id, experienceId))
    .limit(1);

  return experience ?? null;
};

const getMeetingObject = (payload: Record<string, unknown>) =>
    typeof payload.meeting === "object" && payload.meeting !== null
      ? (payload.meeting as Record<string, unknown>)
      : null,
  getString = (value: unknown) =>
    typeof value === "string" && value.length > 0 ? value : null,
  getMeetingId = (payload: Record<string, unknown>) => {
    const meeting = getMeetingObject(payload);
    return getString(meeting?.id) ?? getString(payload.meetingId);
  };

export const markExperienceLive = async (experienceId: string) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const [updated] = await createDb()
    .update(liveExperiences)
    .set({
      ingestStatus: "connected",
      startedAt: new Date(),
      status: "live",
      updatedAt: new Date(),
    })
    .where(eq(liveExperiences.id, experienceId))
    .returning();

  return updated ?? null;
};

export const markExperienceEnded = async (experienceId: string) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const [updated] = await createDb()
    .update(liveExperiences)
    .set({
      endsAt: new Date(),
      ingestStatus: "disconnected",
      status: "ended",
      updatedAt: new Date(),
    })
    .where(eq(liveExperiences.id, experienceId))
    .returning();

  return updated ?? null;
};

export const updateExperienceViewerCount = async ({
  experienceId,
  isJoining,
}: {
  experienceId: string;
  isJoining: boolean;
}) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = createDb(),
    [experience] = await db
      .select({
        peakViewerCount: liveExperiences.peakViewerCount,
        viewerCount: liveExperiences.viewerCount,
      })
      .from(liveExperiences)
      .where(eq(liveExperiences.id, experienceId))
      .limit(1);

  if (!experience) {
    return null;
  }

  const viewerCount = Math.max(
      0,
      experience.viewerCount + (isJoining ? 1 : -1)
    ),
    peakViewerCount = Math.max(experience.peakViewerCount, viewerCount),
    [updated] = await db
      .update(liveExperiences)
      .set({
        peakViewerCount,
        updatedAt: new Date(),
        viewerCount,
      })
      .where(eq(liveExperiences.id, experienceId))
      .returning();

  return updated ?? null;
};

export const getFollowerUserIds = async (artistUserId: string) => {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const rows = await createDb()
    .select({ followerUserId: artistFollows.followerUserId })
    .from(artistFollows)
    .where(eq(artistFollows.artistUserId, artistUserId))
    .limit(500);

  return rows.map(({ followerUserId }) => followerUserId);
};

export const notificationTypeForKind = (kind: LiveExperienceKind) => {
  if (kind === "battle") {
    return "live_battle";
  }

  if (kind === "party") {
    return "live_party";
  }

  return "live_stream";
};

export const notificationHrefForKind = (
  kind: LiveExperienceKind,
  experienceId: string
) => `/live/${kind === "party" ? "parties" : `${kind}s`}/${experienceId}`;

export const insertNotificationsForUsers = async ({
  experienceId,
  kind,
  message,
  recipientUserIds,
  title,
  type,
}: {
  experienceId: string;
  kind: LiveExperienceKind;
  message: string;
  recipientUserIds: string[];
  title: string;
  type: string;
}) => {
  if (!(isDatabaseConfigured() && recipientUserIds.length > 0)) {
    return 0;
  }

  const db = createDb(),
    link = notificationHrefForKind(kind, experienceId),
    rows = recipientUserIds.map((userId) => ({
      id: `${type}:${experienceId}:${userId}`,
      link,
      message,
      title,
      type,
      userId,
    }));

  await db.insert(userNotifications).values(rows).onConflictDoNothing();

  return rows.length;
};

export const fanoutGoLiveNotifications = async ({
  creatorUserId,
  experienceId,
  kind,
  title,
}: {
  creatorUserId: string;
  experienceId: string;
  kind: LiveExperienceKind;
  title: string;
}) => {
  const followerUserIds = await getFollowerUserIds(creatorUserId),
    href = notificationHrefForKind(kind, experienceId);
  let noun: string;

  if (kind === "battle") {
    noun = "battle";
  } else if (kind === "party") {
    noun = "listening party";
  } else {
    noun = "stream";
  }

  const followerNotifications = await insertNotificationsForUsers({
      experienceId,
      kind,
      message: `${title} is live. Tap in to watch, chat, and react.`,
      recipientUserIds: followerUserIds,
      title: `${title} is live`,
      type: `${notificationTypeForKind(kind)}_live`,
    }),
    premiumNotifications = await insertNotificationsForUsers({
      experienceId,
      kind,
      message: `${title} is live. Premium watchers get the full Must Watch room.`,
      recipientUserIds: await getPremiumWatcherUserIds(),
      title: `Must Watch: ${title} is live`,
      type: `${notificationTypeForKind(kind)}_must_watch`,
    });

  return {
    creatorHref: href,
    followerNotifications,
    kind,
    noun,
    premiumNotifications,
    title,
  };
};

const getPremiumWatcherUserIds = async () => {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const db = createDb(),
    subscriptionRows = await db
      .select({
        referenceId: subscription.referenceId,
      })
      .from(subscription)
      .where(inArray(subscription.status, [...ACTIVE_SUBSCRIPTION_STATUSES]))
      .limit(1000),
    memberRows =
      subscriptionRows.length > 0
        ? await db
            .select({ userId: member.userId })
            .from(member)
            .where(
              inArray(
                member.organizationId,
                subscriptionRows.map(({ referenceId }) => referenceId)
              )
            )
        : [],
    userIds: string[] = [];

  for (const row of subscriptionRows) {
    if (row.referenceId) {
      userIds.push(row.referenceId);
    }
  }

  for (const row of memberRows) {
    if (row.userId) {
      userIds.push(row.userId);
    }
  }

  return [...new Set(userIds)];
};

interface RecordingStatusPayload {
  audioDownloadUrl?: unknown;
  downloadUrl?: unknown;
  downloadUrlExpiry?: unknown;
  id?: unknown;
  status?: unknown;
}

export const applyRecordingStatusUpdate = async (
  payload: Record<string, unknown>,
  liveRecordingWorkflow?: Workflow
) => {
  const meetingId = getMeetingId(payload);

  if (!meetingId) {
    return "ignored" as const;
  }

  const experience = await loadLiveExperienceByMeetingId(meetingId);

  if (!experience) {
    return "ignored" as const;
  }

  const recording =
      typeof payload.recording === "object" && payload.recording !== null
        ? (payload.recording as RecordingStatusPayload)
        : {},
    status = getString(recording.status) ?? null;

  if (status !== "UPLOADED") {
    await createDb()
      .update(liveExperiences)
      .set({
        recordingId: getString(recording.id) ?? experience.recordingId,
        recordingStatus: status ?? experience.recordingStatus,
        updatedAt: new Date(),
      })
      .where(eq(liveExperiences.id, experience.id));

    return "processed" as const;
  }

  const downloadUrl = getString(recording.downloadUrl),
    audioDownloadUrl = getString(recording.audioDownloadUrl),
    expiresAt = getString(recording.downloadUrlExpiry),
    [updated] = await createDb()
      .update(liveExperiences)
      .set({
        recordingAudioUrl: audioDownloadUrl ?? experience.recordingAudioUrl,
        recordingExpiresAt: expiresAt ? new Date(expiresAt) : null,
        recordingId: getString(recording.id) ?? experience.recordingId,
        recordingStatus: "UPLOADED",
        recordingUrl: downloadUrl ?? experience.recordingUrl,
        updatedAt: new Date(),
      })
      .where(eq(liveExperiences.id, experience.id))
      .returning();

  if (updated && downloadUrl) {
    if (liveRecordingWorkflow) {
      try {
        await liveRecordingWorkflow.create({
          id: `live-recording-${updated.id}`,
          params: {
            experienceId: updated.id,
            recordingUrl: downloadUrl,
          },
        });
      } catch (error) {
        console.warn("Unable to create live recording workflow", {
          error: error instanceof Error ? error.message : String(error),
          experienceId: updated.id,
        });
      }
    } else {
      await scheduleLiveRecordingPublish({
        experience: updated,
        recordingUrl: downloadUrl,
      });
    }
  }

  return "processed" as const;
};

const LIVE_RECORDING_PUBLISH_JOB_TYPE = "live_recording_publish",
  LIVE_RECORDING_PUBLISH_DELAY_MS = 60 * 60 * 1000,
  LIVE_RECORDING_RETRY_DELAY_MS = 5 * 60 * 1000;

export const scheduleLiveRecordingPublish = async ({
  experience,
  recordingUrl,
}: {
  experience: {
    id: string;
  };
  recordingUrl: string;
}) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = createDb(),
    [existing] = await db
      .select({ id: workflowJobs.id })
      .from(workflowJobs)
      .where(
        and(
          eq(workflowJobs.jobType, LIVE_RECORDING_PUBLISH_JOB_TYPE),
          eq(workflowJobs.targetId, experience.id),
          inArray(workflowJobs.status, ["queued", "running"])
        )
      )
      .limit(1);

  if (existing) {
    return null;
  }

  const [job] = await db
    .insert(workflowJobs)
    .values({
      id: crypto.randomUUID(),
      input: { recordingUrl },
      jobType: LIVE_RECORDING_PUBLISH_JOB_TYPE,
      scheduledAt: new Date(Date.now() + LIVE_RECORDING_PUBLISH_DELAY_MS),
      targetId: experience.id,
      targetType: "live_experience",
    })
    .returning();

  return job?.id ?? null;
};

export const applyChatSyncedEvent = async (
  payload: Record<string, unknown>
) => {
  const meetingId = getMeetingId(payload);

  if (!meetingId) {
    return "ignored" as const;
  }

  const experience = await loadLiveExperienceByMeetingId(meetingId);

  if (!experience) {
    return "ignored" as const;
  }

  const chatDownloadUrl = getString(payload.chatDownloadUrl),
    chatDownloadUrlExpiry = getString(payload.chatDownloadUrlExpiry);

  if (!chatDownloadUrl) {
    return "ignored" as const;
  }

  await createDb()
    .update(liveExperiences)
    .set({
      chatDownloadUrl,
      chatDownloadUrlExpiry: chatDownloadUrlExpiry
        ? new Date(chatDownloadUrlExpiry)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(liveExperiences.id, experience.id));

  return "processed" as const;
};

export const applyMeetingStartedEvent = async (
  payload: Record<string, unknown>,
  liveNotificationQueue?: Queue<LiveNotificationQueueMessage>
) => {
  const meetingId = getMeetingId(payload);

  if (!meetingId) {
    return "ignored" as const;
  }

  const experience = await loadLiveExperienceByMeetingId(meetingId);

  if (!experience) {
    return "ignored" as const;
  }

  const [updated] = await createDb()
    .update(liveExperiences)
    .set({ status: "live", updatedAt: new Date() })
    .where(eq(liveExperiences.id, experience.id))
    .returning();

  if (updated) {
    const notification = {
      creatorUserId: experience.createdByUserId,
      eventType: "live_started" as const,
      experienceId: experience.id,
      kind: experience.kind,
      title: experience.title,
    };
    if (liveNotificationQueue) {
      await liveNotificationQueue.send(notification);
    } else {
      await fanoutGoLiveNotifications(notification);
    }
  }

  return "processed" as const;
};

export const applyMeetingEndedEvent = async (
  payload: Record<string, unknown>
) => {
  const meetingId = getMeetingId(payload);

  if (!meetingId) {
    return "ignored" as const;
  }

  const experience = await loadLiveExperienceByMeetingId(meetingId);

  if (!experience) {
    return "ignored" as const;
  }

  await markExperienceEnded(experience.id);

  if (experience.kind === "battle" && experience.battleId) {
    await updateArtistRecordsForBattle({
      battleId: experience.battleId,
      peakViewerCount: experience.peakViewerCount,
    });
  }

  return "processed" as const;
};

export const applyParticipantJoinedEvent = async (
  payload: Record<string, unknown>
) => {
  const meetingId = getMeetingId(payload);

  if (!meetingId) {
    return "ignored" as const;
  }

  const experience = await loadLiveExperienceByMeetingId(meetingId);

  if (!experience) {
    return "ignored" as const;
  }

  await updateExperienceViewerCount({
    experienceId: experience.id,
    isJoining: true,
  });

  return "processed" as const;
};

export const applyParticipantLeftEvent = async (
  payload: Record<string, unknown>
) => {
  const meetingId = getMeetingId(payload);

  if (!meetingId) {
    return "ignored" as const;
  }

  const experience = await loadLiveExperienceByMeetingId(meetingId);

  if (!experience) {
    return "ignored" as const;
  }

  await updateExperienceViewerCount({
    experienceId: experience.id,
    isJoining: false,
  });

  return "processed" as const;
};

export const updateArtistRecordsForBattle = async ({
  battleId,
  peakViewerCount,
}: {
  battleId: string;
  peakViewerCount: number;
}) => {
  if (!isDatabaseConfigured()) {
    return { losses: 0, skipped: true, wins: 0 };
  }

  if (peakViewerCount < BATTLE_RECORD_THRESHOLD_VIEWERS) {
    return { losses: 0, skipped: true, wins: 0 };
  }

  const db = createDb(),
    roundRows = await db
      .select({
        trackOneId: battleRounds.trackOneId,
        trackTwoId: battleRounds.trackTwoId,
        winningTrackId: battleRounds.winningTrackId,
      })
      .from(battleRounds)
      .where(
        and(
          eq(battleRounds.battleId, battleId),
          eq(battleRounds.status, "completed")
        )
      );

  if (roundRows.length === 0) {
    return { losses: 0, skipped: true, wins: 0 };
  }

  const trackIds = [
    ...new Set(
      roundRows
        .flatMap((round) => [
          round.trackOneId,
          round.trackTwoId,
          round.winningTrackId,
        ])
        .filter((trackId): trackId is string => Boolean(trackId))
    ),
  ];

  if (trackIds.length === 0) {
    return { losses: 0, skipped: true, wins: 0 };
  }

  const trackRows = await db
      .select({
        id: tracks.id,
        ownerUserId: tracks.ownerUserId,
      })
      .from(tracks)
      .where(inArray(tracks.id, trackIds)),
    ownerByTrackId = new Map(
      trackRows.map((track) => [track.id, track.ownerUserId])
    );

  let losses = 0,
    wins = 0;

  const upsertBattleStats = async ({
    isWinner,
    ownerUserId,
    trackId,
  }: {
    isWinner: boolean;
    ownerUserId: string;
    trackId: string;
  }) => {
    const [statsRow] = await db
      .select({
        id: battleStats.id,
        losses: battleStats.losses,
        wins: battleStats.wins,
      })
      .from(battleStats)
      .where(
        and(
          eq(battleStats.trackId, trackId),
          eq(battleStats.userId, ownerUserId)
        )
      )
      .limit(1);

    if (statsRow) {
      await db
        .update(battleStats)
        .set(
          isWinner
            ? { wins: statsRow.wins + 1 }
            : { losses: statsRow.losses + 1 }
        )
        .where(eq(battleStats.id, statsRow.id));
      return;
    }

    await db.insert(battleStats).values({
      downloads: 0,
      id: crypto.randomUUID(),
      losses: isWinner ? 0 : 1,
      purchases: 0,
      saves: 0,
      trackId,
      userId: ownerUserId,
      wins: isWinner ? 1 : 0,
    });
  };

  for (const round of roundRows) {
    const winnerUserId = round.winningTrackId
      ? (ownerByTrackId.get(round.winningTrackId) ?? null)
      : null;

    for (const trackId of [round.trackOneId, round.trackTwoId]) {
      const ownerUserId = trackId
        ? (ownerByTrackId.get(trackId) ?? null)
        : null;

      if (!(trackId && ownerUserId)) {
        continue;
      }

      const isWinner = winnerUserId !== null && winnerUserId === ownerUserId;

      await upsertBattleStats({
        isWinner,
        ownerUserId,
        trackId,
      });

      if (isWinner) {
        wins += 1;
      } else {
        losses += 1;
      }
    }
  }

  return { losses, skipped: false, wins };
};

export const publishExperienceRecordingAsVideo = async ({
  experience,
  recordingUrl,
}: {
  experience: {
    battleId: string | null;
    createdByUserId: string;
    id: string;
    kind: LiveExperienceKind;
    recordingUrl: string | null;
    title: string;
  };
  recordingUrl: string;
}) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = createDb(),
    videoId = `video_live_${experience.id}`,
    slug = `live-${experience.kind}-${experience.id.replaceAll("_", "-")}`,
    playbackUrl = await copyRecordingToPublicMedia({
      experienceId: experience.id,
      sourceUrl: recordingUrl,
    });

  await db
    .insert(videos)
    .values({
      externalPlaybackUrl: playbackUrl ?? recordingUrl,
      id: videoId,
      isPublic: true,
      ownerUserId: experience.createdByUserId,
      playbackPolicy: "public",
      publishedAt: new Date(),
      slug,
      sourceProvider: "external",
      status: "ready",
      title: experience.title,
      videoKind:
        experience.kind === "battle" ? "battle_replay" : "live_recording",
    })
    .onConflictDoNothing();

  if (experience.kind === "battle" && experience.battleId) {
    await db
      .update(battles)
      .set({ replayVideoId: videoId, updatedAt: new Date() })
      .where(eq(battles.id, experience.battleId));
  }

  return videoId;
};

const getRecordingMediaHelpers = () => ({
    bucket:
      (env as unknown as { MEDIA_BUCKET?: R2Bucket }).MEDIA_BUCKET ?? null,
    publicUrl:
      (env as unknown as { MEDIA_PUBLIC_URL?: string | undefined })
        .MEDIA_PUBLIC_URL ??
      (env as unknown as { VITE_MEDIA_URL?: string | undefined })
        .VITE_MEDIA_URL ??
      "",
  }),
  copyRecordingToPublicMedia = async ({
    experienceId,
    sourceUrl,
  }: {
    experienceId: string;
    sourceUrl: string;
  }) => {
    const { bucket, publicUrl } = getRecordingMediaHelpers();

    if (!bucket) {
      return null;
    }

    const extension = /\.(mp4|mov|webm|mkv|m4v)(?:$|[?#])/iu.test(sourceUrl)
        ? "mp4"
        : "mp3",
      objectKey = `live-recordings/${experienceId}/recording.${extension}`;

    try {
      const response = await fetch(sourceUrl);

      if (!response.ok || !response.body) {
        return null;
      }

      await bucket.put(objectKey, response.body, {
        httpMetadata: {
          contentType: extension === "mp4" ? "video/mp4" : "audio/mpeg",
        },
      });

      return `${publicUrl.replace(/\/+$/u, "")}/${objectKey}`;
    } catch {
      return null;
    }
  };

export const publishDueLiveRecordings = async ({
  limit = 10,
  now = new Date(),
}: {
  limit?: number;
  now?: Date;
} = {}) => {
  if (!isDatabaseConfigured()) {
    return { done: 0, failed: 0, skipped: true };
  }

  const db = createDb(),
    jobs = await db
      .select()
      .from(workflowJobs)
      .where(
        and(
          eq(workflowJobs.jobType, LIVE_RECORDING_PUBLISH_JOB_TYPE),
          inArray(workflowJobs.status, ["queued", "running"]),
          lte(workflowJobs.scheduledAt, now)
        )
      )
      .limit(Math.max(1, Math.min(limit, 50)));

  let done = 0,
    failed = 0;

  for (const job of jobs) {
    const input = (job.input ?? {}) as { recordingUrl?: string },
      experience = await loadLiveExperienceById(job.targetId);

    if (!experience || !input.recordingUrl) {
      await db
        .update(workflowJobs)
        .set({
          error: { message: "experience_or_url_missing" },
          finishedAt: new Date(),
          status: "failed",
        })
        .where(eq(workflowJobs.id, job.id));
      failed += 1;
      continue;
    }

    await db
      .update(workflowJobs)
      .set({ error: null, status: "running" })
      .where(eq(workflowJobs.id, job.id));

    try {
      const videoId = await publishExperienceRecordingAsVideo({
        experience,
        recordingUrl: input.recordingUrl,
      });

      if (!videoId) {
        throw new Error("Recording copy or publish failed.");
      }

      await db
        .update(workflowJobs)
        .set({
          finishedAt: new Date(),
          output: { videoId },
          status: "completed",
        })
        .where(eq(workflowJobs.id, job.id));
      done += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db
        .update(workflowJobs)
        .set({
          error: { message },
          scheduledAt: new Date(Date.now() + LIVE_RECORDING_RETRY_DELAY_MS),
          startedAt: null,
          status: "queued",
        })
        .where(eq(workflowJobs.id, job.id));

      logWarn({
        error: message,
        event: "live_recording_publish_failed",
        jobId: job.id,
        targetId: job.targetId,
      });
      failed += 1;
    }
  }

  return { done, failed, skipped: false };
};

export const isRealtimeKitWebhookEvent = (
  value: unknown
): value is RealtimeKitWebhookEnvelope =>
  typeof value === "object" && value !== null && "event" in value;

export const processRealtimeKitWebhookEnvelope = async (
  envelope: RealtimeKitWebhookEnvelope,
  options: {
    liveNotificationQueue?: Queue<LiveNotificationQueueMessage>;
    liveRecordingWorkflow?: Workflow;
  } = {}
): Promise<"ignored" | "processed"> => {
  const payload = envelope as unknown as Record<string, unknown>;

  switch (envelope.event) {
    case "meeting.started": {
      return await applyMeetingStartedEvent(
        payload,
        options.liveNotificationQueue
      );
    }
    case "meeting.ended": {
      return await applyMeetingEndedEvent(payload);
    }
    case "meeting.participantJoined": {
      return await applyParticipantJoinedEvent(payload);
    }
    case "meeting.participantLeft": {
      return await applyParticipantLeftEvent(payload);
    }
    case "recording.statusUpdate": {
      return await applyRecordingStatusUpdate(
        payload,
        options.liveRecordingWorkflow
      );
    }
    case "meeting.chatSynced": {
      return await applyChatSyncedEvent(payload);
    }
    default: {
      return "ignored";
    }
  }
};

export interface BattleBotRoundVoter {
  id: string;
  inLobby?: boolean;
  voted?: boolean;
}

export const roundVoteWinner = (
  round: {
    trackOneId: string | null;
    trackOneVotes: number;
    trackTwoId: string | null;
    trackTwoVotes: number;
  },
  isTiebreaker: boolean
) => {
  if (round.trackOneVotes > round.trackTwoVotes) {
    return round.trackOneId;
  }

  if (round.trackTwoVotes > round.trackOneVotes) {
    return round.trackTwoId;
  }

  return isTiebreaker ? round.trackOneId : null;
};

export const applyBattleBotAction = async ({
  action,
  battleId,
  participants = [],
}: {
  action: string;
  battleId: string;
  participants?: BattleBotRoundVoter[];
}) => {
  if (!isDatabaseConfigured()) {
    return {
      nextPhase: "between_rounds",
      snapshot: { eligible: [], nonVoters: [] },
    };
  }

  const db = createDb(),
    [battle] = await db
      .select({ id: battles.id, status: battles.status })
      .from(battles)
      .where(
        or(eq(battles.id, battleId), eq(battles.externalBattleId, battleId))
      )
      .limit(1);

  if (!battle) {
    return {
      nextPhase: "between_rounds",
      snapshot: { eligible: [], nonVoters: [] },
    };
  }

  const roundRows = await db
      .select({
        id: battleRounds.id,
        isTiebreaker: battleRounds.isTiebreaker,
        roundNumber: battleRounds.roundNumber,
        status: battleRounds.status,
        trackOneId: battleRounds.trackOneId,
        trackOneVotes: battleRounds.trackOneVotes,
        trackTwoId: battleRounds.trackTwoId,
        trackTwoVotes: battleRounds.trackTwoVotes,
      })
      .from(battleRounds)
      .where(eq(battleRounds.battleId, battle.id))
      .orderBy(asc(battleRounds.roundNumber)),
    activeRound = roundRows.find((round) => round.status === "active") ?? null,
    upcomingRound =
      roundRows.find((round) => round.status === "upcoming") ?? null;

  if (action === "open_lobby") {
    await db
      .update(battles)
      .set({ status: "live", updatedAt: new Date() })
      .where(eq(battles.id, battle.id));

    return {
      nextPhase: "lobby",
      snapshot: { eligible: [], nonVoters: [] },
    };
  }

  if (action === "move_lobby_to_round") {
    const targetRound = activeRound ?? upcomingRound;

    if (!targetRound) {
      return {
        nextPhase: "between_rounds",
        snapshot: { eligible: [], nonVoters: [] },
      };
    }

    await db
      .update(battleRounds)
      .set({ status: "active" })
      .where(eq(battleRounds.id, targetRound.id));
    await db
      .update(battles)
      .set({ status: "live", updatedAt: new Date() })
      .where(eq(battles.id, battle.id));

    const inLobby = participants
      .filter((participant) => participant.inLobby)
      .map(({ id }) => id);

    return {
      admitted: inLobby,
      nextPhase: "round_active",
      snapshot: { eligible: inLobby, nonVoters: [] },
    };
  }

  if (action === "close_voting" || action === "complete_round") {
    if (!activeRound) {
      return {
        nextPhase: "between_rounds",
        snapshot: { eligible: [], nonVoters: [] },
      };
    }

    const winnerTrackId = roundVoteWinner(
      activeRound,
      activeRound.isTiebreaker
    );

    await db
      .update(battleRounds)
      .set({
        status: "completed",
        winningTrackId: winnerTrackId,
      })
      .where(eq(battleRounds.id, activeRound.id));

    const nextRound = upcomingRound;

    if (nextRound) {
      await db
        .update(battleRounds)
        .set({ status: "active" })
        .where(eq(battleRounds.id, nextRound.id));

      const nonVoters = participants
          .filter((participant) => !participant.voted)
          .map(({ id }) => id),
        inLobby = participants
          .filter((participant) => participant.inLobby)
          .map(({ id }) => id);

      return {
        admitted: inLobby,
        booted: nonVoters,
        nextPhase: "round_active",
        snapshot: { eligible: inLobby, nonVoters },
        winnerTrackId,
      };
    }

    await db
      .update(battles)
      .set({ endedAt: new Date(), status: "completed", updatedAt: new Date() })
      .where(eq(battles.id, battle.id));
    const [experience] = await db
      .select({ peakViewerCount: liveExperiences.peakViewerCount })
      .from(liveExperiences)
      .where(eq(liveExperiences.battleId, battle.id))
      .limit(1);

    if (experience) {
      await updateArtistRecordsForBattle({
        battleId: battle.id,
        peakViewerCount: experience.peakViewerCount,
      });
    }

    const nonVoters = participants
      .filter((participant) => !participant.voted)
      .map(({ id }) => id);

    return {
      booted: nonVoters,
      nextPhase: "ended",
      snapshot: { eligible: [], nonVoters },
      winnerTrackId,
    };
  }

  const inLobby = participants
      .filter((participant) => participant.inLobby)
      .map(({ id }) => id),
    nonVoters = participants
      .filter((participant) => !participant.voted)
      .map(({ id }) => id);

  return {
    nextPhase: "between_rounds",
    snapshot: { eligible: inLobby, nonVoters },
  };
};

export const buildLiveExperienceInsert = ({
  battleId,
  battleKitId,
  createdByUserId,
  genre,
  id,
  kind,
  meetingId,
  playlistId,
  projectId,
  source,
  startsAt,
  streamInputId,
  title,
  visibility,
}: {
  battleId: string | null | undefined;
  battleKitId: string | null | undefined;
  createdByUserId: string;
  genre?: string | null;
  id: string;
  kind: LiveExperienceKind;
  meetingId: string;
  playlistId: string | null | undefined;
  projectId: string | null | undefined;
  source: string;
  startsAt: string;
  streamInputId?: string | null;
  title: string;
  visibility: string;
}) => ({
  battleId: battleId ?? null,
  battleKitId: battleKitId ?? null,
  createdByUserId,
  genre: genre ?? null,
  id,
  ingestStatus:
    kind === "stream" && source === "obs" ? "waiting_for_ingest" : "idle",
  kind,
  meetingId,
  playlistId: playlistId ?? null,
  projectId: projectId ?? null,
  source,
  startsAt: new Date(startsAt),
  streamInputId: streamInputId ?? null,
  title,
  visibility,
});
