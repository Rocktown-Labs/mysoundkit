import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  battleParticipations,
  battleQueueEntries,
  battleRounds,
  battles,
  battleStats,
  liveExperiences,
  listeningParties,
  tracks,
  userNotifications,
  videos,
  workflowJobs,
} from "@soundkit/db/schema/app";
import {
  member,
  subscription,
  user as authUser,
} from "@soundkit/db/schema/auth";
import { env } from "@soundkit/env/server";
import { and, asc, eq, inArray, lte, or } from "drizzle-orm";

import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import { battleHasPlayedTurn } from "@/lib/battle-display";
import type { LiveExperienceKind } from "@/lib/live-experience";
import type { LiveNotificationQueueMessage } from "@/lib/live-notifications";
import { notify } from "@/lib/notifications";
import { logWarn } from "@/middleware/structured-logging";

export const BATTLE_RECORD_THRESHOLD_VIEWERS = 10;

export type BattleParticipationResult =
  | "canceled"
  | "ducked"
  | "forfeited"
  | "loss"
  | "quit"
  | "tie"
  | "win";

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

  const db = createDb(),
    now = new Date(),
    [updated] = await db
      .update(liveExperiences)
      .set({
        ingestStatus: "connected",
        startedAt: now,
        status: "live",
        updatedAt: now,
      })
      .where(eq(liveExperiences.id, experienceId))
      .returning();

  if (updated?.kind === "party") {
    await db
      .update(listeningParties)
      .set({ startedAt: now, status: "live", updatedAt: now })
      .where(eq(listeningParties.liveRoomId, experienceId));
  }

  return updated ?? null;
};

export const markExperienceEnded = async (experienceId: string) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = createDb(),
    now = new Date(),
    [updated] = await db
      .update(liveExperiences)
      .set({
        endsAt: now,
        ingestStatus: "disconnected",
        status: "ended",
        updatedAt: now,
      })
      .where(eq(liveExperiences.id, experienceId))
      .returning();

  if (updated?.kind === "party") {
    await db
      .update(listeningParties)
      .set({ endedAt: now, status: "ended", updatedAt: now })
      .where(eq(listeningParties.liveRoomId, experienceId));
  }

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

const mapInBatches = async <Input, Output>(
  items: Input[],
  handler: (item: Input) => Promise<Output>,
  batchSize = 25
): Promise<Output[]> => {
  const results: Output[] = [];
  let offset = 0;

  while (offset < items.length) {
    const batch = items.slice(offset, offset + batchSize),
      batchResults = await Promise.all(batch.map(handler));
    for (const result of batchResults) {
      results.push(result);
    }
    offset += batchSize;
  }

  return results;
};

export const fanoutGoLiveNotifications = async ({
  creatorUserId,
  emailQueue,
  experienceId,
  kind,
  title,
}: {
  creatorUserId: string;
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  experienceId: string;
  kind: LiveExperienceKind;
  title: string;
}) => {
  if (!isDatabaseConfigured()) {
    return {
      creatorHref: notificationHrefForKind(kind, experienceId),
      followerNotifications: 0,
      kind,
      noun: kind,
      premiumNotifications: 0,
      title,
    };
  }

  const db = createDb(),
    [creator] = await db
      .select({ name: authUser.name })
      .from(authUser)
      .where(eq(authUser.id, creatorUserId))
      .limit(1),
    artistName = creator?.name ?? "An artist you follow",
    followerUserIds = await getFollowerUserIds(creatorUserId),
    href = notificationHrefForKind(kind, experienceId),
    premiumUserIds = await getPremiumWatcherUserIds();
  let noun: string;

  if (kind === "battle") {
    noun = "battle";
  } else if (kind === "party") {
    noun = "listening party";
  } else {
    noun = "stream";
  }

  const followerResults = await mapInBatches(
      followerUserIds,
      (recipientUserId) =>
        notify(
          {
            actorUserId: creatorUserId,
            data: {
              artistName,
              experienceId,
              experienceTitle: title,
              href,
              kind,
            },
            entity: { id: experienceId, type: "live_experience" },
            eventId: experienceId,
            recipientUserId,
            type: "artist.live",
          },
          { emailQueue }
        )
    ),
    premiumResults = await mapInBatches(premiumUserIds, (recipientUserId) =>
      notify({
        actorUserId: creatorUserId,
        data: {
          artistName,
          experienceId,
          experienceTitle: title,
          href,
          kind,
        },
        entity: { id: experienceId, type: "live_experience" },
        eventId: experienceId,
        recipientUserId,
        type: "live.must_watch",
      })
    ),
    followerNotifications = followerResults.filter(
      ({ inApp }) => inApp === "created"
    ).length,
    premiumNotifications = premiumResults.filter(
      ({ inApp }) => inApp === "created"
    ).length;

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

  if (updated && downloadUrl && (await canPublishBattleReplay(updated))) {
    if (updated.replayPublishedAt) {
      return "processed" as const;
    }

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
        console.warn("Unable to create live recording workflow; queueing fallback", {
          error: error instanceof Error ? error.message : String(error),
          experienceId: updated.id,
        });
        await scheduleLiveRecordingPublish({
          experience: updated,
          recordingUrl: downloadUrl,
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

export const canPublishBattleReplay = async (experience: {
    battleId: string | null;
    startedAt: Date | null;
  }) => {
    if (!experience.battleId) {
      return true;
    }

    const db = createDb(),
      [battle] = await db
        .select({ outcome: battles.outcome })
        .from(battles)
        .where(eq(battles.id, experience.battleId))
        .limit(1),
      rounds = await db
        .select({ status: battleRounds.status })
        .from(battleRounds)
        .where(eq(battleRounds.battleId, experience.battleId));

    return battleHasPlayedTurn({
      experienceStartedAt: experience.startedAt,
      outcome: battle?.outcome,
      roundStatuses: rounds.map((round) => round.status),
    });
  };

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
      .select({ id: workflowJobs.id, status: workflowJobs.status })
      .from(workflowJobs)
      .where(
        and(
          eq(workflowJobs.jobType, LIVE_RECORDING_PUBLISH_JOB_TYPE),
          eq(workflowJobs.targetId, experience.id)
        )
      )
      .limit(1),
    scheduledAt = new Date(Date.now() + LIVE_RECORDING_PUBLISH_DELAY_MS);

  if (
    existing?.status === "completed" ||
    existing?.status === "queued" ||
    existing?.status === "running"
  ) {
    return null;
  }

  if (existing) {
    await db
      .update(workflowJobs)
      .set({
        error: null,
        finishedAt: null,
        input: { recordingUrl },
        scheduledAt,
        startedAt: null,
        status: "queued",
      })
      .where(eq(workflowJobs.id, existing.id));
    return existing.id;
  }

  const [job] = await db
    .insert(workflowJobs)
    .values({
      id: `live-recording-${experience.id}`,
      input: { recordingUrl },
      jobType: LIVE_RECORDING_PUBLISH_JOB_TYPE,
      scheduledAt,
      targetId: experience.id,
      targetType: "live_experience",
    })
    .onConflictDoNothing()
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

  const db = createDb(),
    now = new Date(),
    [updated] = await db
      .update(liveExperiences)
      .set({ startedAt: now, status: "live", updatedAt: now })
      .where(eq(liveExperiences.id, experience.id))
      .returning();

  if (updated?.kind === "party") {
    await db
      .update(listeningParties)
      .set({ startedAt: now, status: "live", updatedAt: now })
      .where(eq(listeningParties.liveRoomId, experience.id));
  }

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
    const db = createDb(),
      endedAt = new Date();
    await Promise.all([
      db
        .update(battles)
        .set({
          endedAt,
          status: "completed",
          updatedAt: endedAt,
        })
        .where(
          and(eq(battles.id, experience.battleId), eq(battles.status, "live"))
        ),
      db
        .update(battleQueueEntries)
        .set({
          leftAt: endedAt,
          status: "removed",
          updatedAt: endedAt,
        })
        .where(eq(battleQueueEntries.battleId, experience.battleId)),
    ]);
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

const upsertBattleParticipation = async ({
    battleId,
    db,
    isRanked,
    result,
    roundsPlayed,
    roundsWon,
    userId,
  }: {
    battleId: string;
    db: ReturnType<typeof createDb>;
    isRanked: boolean;
    result: BattleParticipationResult;
    roundsPlayed: number;
    roundsWon: number;
    userId: string;
  }) => {
    await db
      .insert(battleParticipations)
      .values({
        battleId,
        id: crypto.randomUUID(),
        isRanked,
        result,
        roundsPlayed,
        roundsWon,
        userId,
      })
      .onConflictDoUpdate({
        set: {
          isRanked,
          result,
          roundsPlayed,
          roundsWon,
          updatedAt: new Date(),
        },
        target: [battleParticipations.battleId, battleParticipations.userId],
      });
  },
  recordBattleParticipationOutcome = async ({
    affectedUserId,
    battleId,
    kind,
    peakViewerCount,
  }: {
    affectedUserId?: string | null;
    battleId: string;
    kind: "canceled" | "ducked" | "forfeited" | "quit";
    peakViewerCount: number;
  }) => {
    if (!isDatabaseConfigured()) {
      return { ranked: false, skipped: true };
    }

    const db = createDb(),
      [battle] = await db
        .select({
          challengerArtistUserId: battles.challengerArtistUserId,
          opponentArtistUserId: battles.opponentArtistUserId,
        })
        .from(battles)
        .where(eq(battles.id, battleId))
        .limit(1),
      artistIds = [
        battle?.challengerArtistUserId,
        battle?.opponentArtistUserId,
      ].filter((userId): userId is string => Boolean(userId));

    if (artistIds.length === 0) {
      return { ranked: false, skipped: true };
    }

    const isRanked = peakViewerCount >= BATTLE_RECORD_THRESHOLD_VIEWERS,
      hasAffectedArtist = Boolean(
        affectedUserId && artistIds.includes(affectedUserId)
      ),
      otherResult: BattleParticipationResult = hasAffectedArtist
        ? "win"
        : "canceled";

    await Promise.all(
      artistIds.map((userId) =>
        upsertBattleParticipation({
          battleId,
          db,
          isRanked,
          result:
            hasAffectedArtist && userId === affectedUserId ? kind : otherResult,
          roundsPlayed: 0,
          roundsWon: 0,
          userId,
        })
      )
    );

    return { ranked: isRanked, skipped: false };
  },
  recordBattleParticipationForCompletion = async ({
    battleId,
    peakViewerCount,
  }: {
    battleId: string;
    peakViewerCount: number;
  }) => {
    if (!isDatabaseConfigured()) {
      return { alreadyRecorded: false, ranked: false, skipped: true };
    }

    const db = createDb(),
      [battle] = await db
        .select({
          challengerArtistUserId: battles.challengerArtistUserId,
          isRanked: battles.isRanked,
          opponentArtistUserId: battles.opponentArtistUserId,
          outcome: battles.outcome,
        })
        .from(battles)
        .where(eq(battles.id, battleId))
        .limit(1),
      artistIds = [
        battle?.challengerArtistUserId,
        battle?.opponentArtistUserId,
      ].filter((userId): userId is string => Boolean(userId));

    if (artistIds.length === 0) {
      return { alreadyRecorded: false, ranked: false, skipped: true };
    }
    if (battle?.outcome) {
      return {
        alreadyRecorded: true,
        ranked: battle.isRanked,
        skipped: true,
      };
    }

    const existingParticipationRows = await db
        .select({ userId: battleParticipations.userId })
        .from(battleParticipations)
        .where(eq(battleParticipations.battleId, battleId)),
      alreadyRecorded = artistIds.every((userId) =>
        existingParticipationRows.some((row) => row.userId === userId)
      ),
      rounds = await db
        .select({
          status: battleRounds.status,
          winningTrackId: battleRounds.winningTrackId,
        })
        .from(battleRounds)
        .where(eq(battleRounds.battleId, battleId)),
      trackIds = rounds
        .map((round) => round.winningTrackId)
        .filter((trackId): trackId is string => Boolean(trackId)),
      winningTracks =
        trackIds.length > 0
          ? await db
              .select({ id: tracks.id, ownerUserId: tracks.ownerUserId })
              .from(tracks)
              .where(inArray(tracks.id, trackIds))
          : [],
      ownerByTrackId = new Map(
        winningTracks.map((track) => [track.id, track.ownerUserId])
      ),
      roundsWonByUserId = new Map(artistIds.map((userId) => [userId, 0])),
      completedRounds = rounds.filter((round) => round.status === "completed");

    for (const round of completedRounds) {
      const winnerUserId = round.winningTrackId
        ? ownerByTrackId.get(round.winningTrackId)
        : null;
      if (winnerUserId && roundsWonByUserId.has(winnerUserId)) {
        roundsWonByUserId.set(
          winnerUserId,
          (roundsWonByUserId.get(winnerUserId) ?? 0) + 1
        );
      }
    }

    const [firstArtistId, secondArtistId] = artistIds,
      firstScore = firstArtistId
        ? (roundsWonByUserId.get(firstArtistId) ?? 0)
        : 0,
      secondScore = secondArtistId
        ? (roundsWonByUserId.get(secondArtistId) ?? 0)
        : 0,
      winnerUserId =
        firstScore === secondScore
          ? null
          : firstScore > secondScore
            ? firstArtistId
            : secondArtistId,
      isRanked = peakViewerCount >= BATTLE_RECORD_THRESHOLD_VIEWERS;

    await Promise.all(
      artistIds.map((userId) =>
        upsertBattleParticipation({
          battleId,
          db,
          isRanked,
          result:
            winnerUserId === null
              ? "tie"
              : winnerUserId === userId
                ? "win"
                : "loss",
          roundsPlayed: completedRounds.length,
          roundsWon: roundsWonByUserId.get(userId) ?? 0,
          userId,
        })
      )
    );
    await db
      .update(battles)
      .set({ isRanked, updatedAt: new Date(), winnerUserId })
      .where(eq(battles.id, battleId));

    return { alreadyRecorded, ranked: isRanked, skipped: false, winnerUserId };
  };

export { recordBattleParticipationOutcome };

export const updateArtistRecordsForBattle = async ({
  battleId,
  peakViewerCount,
}: {
  battleId: string;
  peakViewerCount: number;
}) => {
  if (!isDatabaseConfigured()) {
    return { losses: 0, skipped: true, ties: 0, wins: 0 };
  }

  const completionRecord = await recordBattleParticipationForCompletion({
    battleId,
    peakViewerCount,
  });

  if (
    peakViewerCount < BATTLE_RECORD_THRESHOLD_VIEWERS ||
    completionRecord.alreadyRecorded
  ) {
    return { losses: 0, skipped: true, ties: 0, wins: 0 };
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
    return { losses: 0, skipped: true, ties: 0, wins: 0 };
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
    return { losses: 0, skipped: true, ties: 0, wins: 0 };
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
    ties = 0,
    wins = 0;

  const upsertBattleStats = async ({
    ownerUserId,
    result,
    trackId,
  }: {
    ownerUserId: string;
    result: "loss" | "tie" | "win";
    trackId: string;
  }) => {
    const [statsRow] = await db
      .select({
        id: battleStats.id,
        losses: battleStats.losses,
        ties: battleStats.ties,
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
          result === "win"
            ? { wins: statsRow.wins + 1 }
            : result === "tie"
              ? { ties: statsRow.ties + 1 }
              : { losses: statsRow.losses + 1 }
        )
        .where(eq(battleStats.id, statsRow.id));
      return;
    }

    await db.insert(battleStats).values({
      downloads: 0,
      id: crypto.randomUUID(),
      losses: result === "loss" ? 1 : 0,
      purchases: 0,
      saves: 0,
      ties: result === "tie" ? 1 : 0,
      trackId,
      userId: ownerUserId,
      wins: result === "win" ? 1 : 0,
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

      const result =
        winnerUserId === null
          ? ("tie" as const)
          : winnerUserId === ownerUserId
            ? ("win" as const)
            : ("loss" as const);

      await upsertBattleStats({
        ownerUserId,
        result,
        trackId,
      });

      if (result === "win") {
        wins += 1;
      } else if (result === "tie") {
        ties += 1;
      } else {
        losses += 1;
      }
    }
  }

  return { losses, skipped: false, ties, wins };
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
    startedAt?: Date | null;
    title: string;
  };
  recordingUrl: string;
}) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = createDb();
  if (
    experience.kind === "battle" &&
    experience.battleId &&
    !(await canPublishBattleReplay({
      battleId: experience.battleId,
      startedAt: experience.startedAt ?? null,
    }))
  ) {
    return null;
  }

  const videoId = `video_live_${experience.id}`,
    slug = `live-${experience.kind}-${experience.id.replaceAll("_", "-")}`,
    playbackUrl = await copyRecordingToPublicMedia({
      experienceId: experience.id,
      sourceUrl: recordingUrl,
    });

  if (!playbackUrl) {
    throw new Error("Recording was not copied to durable public media.");
  }

  const publishedAt = new Date();
  await db
    .insert(videos)
    .values({
      externalPlaybackUrl: playbackUrl,
      id: videoId,
      isPublic: true,
      ownerUserId: experience.createdByUserId,
      playbackPolicy: "public",
      publishedAt,
      slug,
      sourceProvider: "external",
      status: "ready",
      title: experience.title,
      videoKind:
        experience.kind === "battle" ? "battle_replay" : "live_recording",
    })
    .onConflictDoUpdate({
      set: {
        externalPlaybackUrl: playbackUrl,
        isPublic: true,
        playbackPolicy: "public",
        publishedAt,
        status: "ready",
      },
      target: videos.id,
    });

  await db
    .update(liveExperiences)
    .set({ replayPublishedAt: publishedAt, updatedAt: publishedAt })
    .where(eq(liveExperiences.id, experience.id));

  if (experience.kind === "battle" && experience.battleId) {
    await db
      .update(battles)
      .set({ replayVideoId: videoId, updatedAt: publishedAt })
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

    if (!bucket || !publicUrl) {
      return null;
    }

    const extension = "mp4";

    try {
      const response = await fetch(sourceUrl);

      if (!response.ok || !response.body) {
        return null;
      }

      const objectKey = `live-recordings/${experienceId}/recording.${extension}`;
      await bucket.put(objectKey, response.body, {
        httpMetadata: {
          contentType: response.headers.get("content-type") ?? "video/mp4",
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

    if (
      experience.kind === "battle" &&
      experience.battleId &&
      !(await canPublishBattleReplay({
        battleId: experience.battleId,
        startedAt: experience.startedAt,
      }))
    ) {
      await db
        .update(workflowJobs)
        .set({
          error: null,
          finishedAt: new Date(),
          output: { reason: "battle_did_not_reach_a_turn", skipped: true },
          status: "completed",
        })
        .where(eq(workflowJobs.id, job.id));
      done += 1;
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
  _isTiebreaker?: boolean
) => {
  if (round.trackOneVotes > round.trackTwoVotes) {
    return round.trackOneId;
  }

  if (round.trackTwoVotes > round.trackOneVotes) {
    return round.trackTwoId;
  }

  return null;
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

  if (battle.status === "completed" || battle.status === "archived") {
    return {
      battleEnded: true,
      nextPhase: "ended",
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

  if (action === "move_lobby_to_round" || action === "start_battle") {
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

    const endedAt = new Date();
    await Promise.all([
      db
        .update(battles)
        .set({ endedAt, status: "completed", updatedAt: endedAt })
        .where(eq(battles.id, battle.id)),
      db
        .update(liveExperiences)
        .set({
          endsAt: endedAt,
          ingestStatus: "disconnected",
          status: "ended",
          updatedAt: endedAt,
        })
        .where(eq(liveExperiences.battleId, battle.id)),
      db
        .update(battleQueueEntries)
        .set({
          leftAt: endedAt,
          status: "removed",
          updatedAt: endedAt,
        })
        .where(eq(battleQueueEntries.battleId, battle.id)),
    ]);
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
