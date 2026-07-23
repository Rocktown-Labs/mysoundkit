import type { createDb } from "@soundkit/db";
import {
  accountingPeriods,
  playbackSessions,
  projectTracks,
  projects,
  qualifiedStreams,
  recentPlays,
  recordingRightsholders,
  rewardConfigurationVersions,
  rewardUnits,
  trackAssets,
  trackCollaborators,
  tracks,
} from "@soundkit/db/schema/app";
import { member, subscription } from "@soundkit/db/schema/auth";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";

import {
  hasReachedQualifiedPlayback,
  qualificationWindowKey,
  shouldExcludeArtistSeatStream,
  streamQualificationRuleVersion,
} from "./stream-qualification-rules";

type SoundKitDb = ReturnType<typeof createDb>;

const defaultRewardConfig = {
  currency: "USD",
  deduplicationWindowHours: 24,
  id: null as string | null,
  playbackThresholdPercent: 70,
  playbackThresholdSeconds: 0,
  version: streamQualificationRuleVersion,
};

const qualifyingAssetKinds = [
  "master",
  "tagged_mp3",
  "untagged_wav",
  "variant_audio",
  "instrumental",
] as const;

const financialCollaboratorRoles = [
  "artist",
  "producer",
  "vocalist",
  "songwriter",
] as const;
const activeSubscriptionStatuses = ["active", "trialing"] as const;
const artistPremiumPlanCodes = ["soundkit_premium_artist", "artist_team"];

export interface PlaybackEntitlementSnapshot {
  activePlanCode: string | null;
  isPremium: boolean;
  status: string | null;
}

export interface PlaybackSessionInput {
  city?: string;
  clientType?: string;
  clientVersion?: string;
  countryCode?: string;
  entitlementSnapshot: PlaybackEntitlementSnapshot;
  listenerUserId: string;
  regionCode?: string;
  sourceId?: string;
  sourceType: typeof playbackSessions.$inferSelect.sourceType;
  trackId: string;
}

export interface PlaybackProgressInput {
  durationSeconds?: number;
  ended?: boolean;
  isMuted?: boolean;
  listenerUserId: string;
  playedSeconds: number;
  sessionId: string;
  trackId: string;
}

export type PlaybackQualificationResult =
  | "already_qualified"
  | "duplicate"
  | "ineligible"
  | "not_ready"
  | "qualified";

const monthWindow = (date: Date) => {
  const startsAt = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
  );
  const endsAt = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
  );

  return { endsAt, startsAt };
};

const getActiveRewardConfig = async (db: SoundKitDb) => {
  const [config] = await db
    .select({
      currency: rewardConfigurationVersions.currency,
      deduplicationWindowHours:
        rewardConfigurationVersions.deduplicationWindowHours,
      id: rewardConfigurationVersions.id,
      playbackThresholdPercent:
        rewardConfigurationVersions.playbackThresholdPercent,
      playbackThresholdSeconds:
        rewardConfigurationVersions.playbackThresholdSeconds,
      version: rewardConfigurationVersions.version,
    })
    .from(rewardConfigurationVersions)
    .where(eq(rewardConfigurationVersions.status, "active"))
    .orderBy(desc(rewardConfigurationVersions.version))
    .limit(1);

  return config ?? defaultRewardConfig;
};

const getOrCreateAccountingPeriod = async ({
  configurationVersionId,
  currency,
  db,
  now,
}: {
  configurationVersionId: string | null;
  currency: string;
  db: SoundKitDb;
  now: Date;
}) => {
  const { endsAt, startsAt } = monthWindow(now);
  const [existing] = await db
    .select({ id: accountingPeriods.id })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.periodType, "monthly"),
        eq(accountingPeriods.currency, currency),
        eq(accountingPeriods.startsAt, startsAt),
        eq(accountingPeriods.endsAt, endsAt)
      )
    )
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const id = crypto.randomUUID();
  await db
    .insert(accountingPeriods)
    .values({
      configurationVersionId,
      currency,
      endsAt,
      id,
      periodType: "monthly",
      startsAt,
      status: "open",
    })
    .onConflictDoNothing();

  const [period] = await db
    .select({ id: accountingPeriods.id })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.periodType, "monthly"),
        eq(accountingPeriods.currency, currency),
        eq(accountingPeriods.startsAt, startsAt),
        eq(accountingPeriods.endsAt, endsAt)
      )
    )
    .limit(1);

  return period?.id ?? id;
};

const getPublicTrackWithPrimaryAsset = async ({
  db,
  trackId,
}: {
  db: SoundKitDb;
  trackId: string;
}) => {
  const [track] = await db
    .select({
      id: tracks.id,
      isPublic: tracks.isPublic,
      organizationId: tracks.organizationId,
      ownerUserId: tracks.ownerUserId,
    })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);

  if (!track?.isPublic) {
    return null;
  }

  // Projects listed for sale stay purchase-only until the artist opens streaming.
  // Give creators a sales window before Premium streams qualify on those cuts.
  const [forSaleProject] = await db
    .select({ projectId: projects.id })
    .from(projectTracks)
    .innerJoin(projects, eq(projects.id, projectTracks.projectId))
    .where(
      and(eq(projectTracks.trackId, trackId), eq(projects.isForSale, true))
    )
    .limit(1);

  if (forSaleProject) {
    return null;
  }

  const [asset] = await db
    .select({
      durationMs: trackAssets.durationMs,
      id: trackAssets.id,
    })
    .from(trackAssets)
    .where(
      and(
        eq(trackAssets.trackId, trackId),
        inArray(trackAssets.assetKind, [...qualifyingAssetKinds])
      )
    )
    .orderBy(desc(trackAssets.durationMs))
    .limit(1);

  return {
    ...track,
    assetId: asset?.id ?? null,
    durationMs: asset?.durationMs ?? null,
  };
};

const listenerHasFinancialInterest = async ({
  db,
  listenerUserId,
  organizationId,
  ownerUserId,
  trackId,
}: {
  db: SoundKitDb;
  listenerUserId: string;
  organizationId: string | null;
  ownerUserId: string;
  trackId: string;
}) => {
  if (listenerUserId === ownerUserId) {
    return true;
  }

  if (organizationId) {
    const rows = await db
      .select({ memberUserId: member.userId })
      .from(member)
      .innerJoin(
        subscription,
        eq(subscription.referenceId, member.organizationId)
      )
      .where(
        and(
          eq(member.organizationId, organizationId),
          inArray(subscription.plan, artistPremiumPlanCodes),
          inArray(subscription.status, [...activeSubscriptionStatuses])
        )
      );

    if (
      shouldExcludeArtistSeatStream({
        artistPlanMemberUserIds: rows.map(({ memberUserId }) => memberUserId),
        listenerUserId,
      })
    ) {
      return true;
    }
  }

  const [collaborator] = await db
    .select({ id: trackCollaborators.id })
    .from(trackCollaborators)
    .where(
      and(
        eq(trackCollaborators.trackId, trackId),
        eq(trackCollaborators.collaboratorUserId, listenerUserId),
        eq(trackCollaborators.invitationStatus, "accepted"),
        inArray(trackCollaborators.collaboratorRole, [
          ...financialCollaboratorRoles,
        ])
      )
    )
    .limit(1);

  if (collaborator) {
    return true;
  }

  const [rightsholder] = await db
    .select({ id: recordingRightsholders.id })
    .from(recordingRightsholders)
    .where(
      and(
        eq(recordingRightsholders.trackId, trackId),
        eq(recordingRightsholders.payeeType, "artist"),
        eq(recordingRightsholders.payeeId, listenerUserId),
        eq(recordingRightsholders.status, "active"),
        or(
          isNull(recordingRightsholders.effectiveTo),
          gt(recordingRightsholders.effectiveTo, new Date())
        )
      )
    )
    .limit(1);

  return Boolean(rightsholder);
};

const updateRecentPlay = async ({
  db,
  listenerUserId,
  now,
  trackId,
}: {
  db: SoundKitDb;
  listenerUserId: string;
  now: Date;
  trackId: string;
}) => {
  const [existing] = await db
    .select({ id: recentPlays.id, playCount: recentPlays.playCount })
    .from(recentPlays)
    .where(
      and(
        eq(recentPlays.userId, listenerUserId),
        eq(recentPlays.trackId, trackId)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(recentPlays)
      .set({
        lastPlayedAt: now,
        playCount: sql`${recentPlays.playCount} + 1`,
      })
      .where(eq(recentPlays.id, existing.id));
    return;
  }

  await db.insert(recentPlays).values({
    id: crypto.randomUUID(),
    lastPlayedAt: now,
    playCount: 1,
    trackId,
    userId: listenerUserId,
  });
};

export const createTrackPlaybackSession = async ({
  db,
  input,
}: {
  db: SoundKitDb;
  input: PlaybackSessionInput;
}) => {
  const track = await getPublicTrackWithPrimaryAsset({
    db,
    trackId: input.trackId,
  });

  if (!track) {
    return null;
  }

  const now = new Date();
  const id = crypto.randomUUID();
  await db.insert(playbackSessions).values({
    assetId: track.assetId,
    city: input.city,
    clientType: input.clientType,
    clientVersion: input.clientVersion,
    countryCode: input.countryCode,
    entitlementSnapshot: input.entitlementSnapshot,
    id,
    lastHeartbeatAt: now,
    organizationId: track.organizationId,
    premiumAtStart: input.entitlementSnapshot.isPremium,
    regionCode: input.regionCode,
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    startedAt: now,
    status: "started",
    trackId: input.trackId,
    userId: input.listenerUserId,
  });
  await updateRecentPlay({
    db,
    listenerUserId: input.listenerUserId,
    now,
    trackId: input.trackId,
  });

  return {
    canQualify: input.entitlementSnapshot.isPremium,
    durationSeconds: track.durationMs
      ? Math.ceil(track.durationMs / 1000)
      : null,
    id,
  };
};

export const recordPlaybackProgress = async ({
  db,
  input,
}: {
  db: SoundKitDb;
  input: PlaybackProgressInput;
}) => {
  const now = new Date();
  const [session] = await db
    .select()
    .from(playbackSessions)
    .where(
      and(
        eq(playbackSessions.id, input.sessionId),
        eq(playbackSessions.trackId, input.trackId),
        eq(playbackSessions.userId, input.listenerUserId)
      )
    )
    .limit(1);

  if (!session || session.status === "rejected") {
    return { result: "ineligible" as PlaybackQualificationResult };
  }

  const playedSeconds = Math.max(session.playedSeconds, input.playedSeconds);
  await db
    .update(playbackSessions)
    .set({
      endedAt: input.ended ? now : session.endedAt,
      lastHeartbeatAt: now,
      mutedSeconds: input.isMuted
        ? Math.max(session.mutedSeconds, playedSeconds)
        : session.mutedSeconds,
      playedSeconds,
      status: input.ended ? "ended" : "active",
    })
    .where(eq(playbackSessions.id, input.sessionId));

  const [existingForSession] = await db
    .select({ id: qualifiedStreams.id })
    .from(qualifiedStreams)
    .where(eq(qualifiedStreams.playbackSessionId, input.sessionId))
    .limit(1);

  if (existingForSession) {
    return { result: "already_qualified" as PlaybackQualificationResult };
  }

  if (!session.premiumAtStart) {
    return { result: "ineligible" as PlaybackQualificationResult };
  }

  const track = await getPublicTrackWithPrimaryAsset({
    db,
    trackId: input.trackId,
  });

  if (!track) {
    return { result: "ineligible" as PlaybackQualificationResult };
  }

  const durationSeconds =
    input.durationSeconds ??
    (track.durationMs ? Math.ceil(track.durationMs / 1000) : 0);
  const config = await getActiveRewardConfig(db);

  if (
    !hasReachedQualifiedPlayback({
      durationSeconds,
      playedSeconds,
      thresholdPercent: config.playbackThresholdPercent,
      thresholdSeconds: config.playbackThresholdSeconds,
    })
  ) {
    return { result: "not_ready" as PlaybackQualificationResult };
  }

  if (
    await listenerHasFinancialInterest({
      db,
      listenerUserId: input.listenerUserId,
      organizationId: track.organizationId,
      ownerUserId: track.ownerUserId,
      trackId: input.trackId,
    })
  ) {
    return { result: "ineligible" as PlaybackQualificationResult };
  }

  const duplicateCutoff = new Date(
    now.getTime() - config.deduplicationWindowHours * 60 * 60 * 1000
  );
  const [recentQualified] = await db
    .select({ id: qualifiedStreams.id })
    .from(qualifiedStreams)
    .where(
      and(
        eq(qualifiedStreams.userId, input.listenerUserId),
        eq(qualifiedStreams.trackId, input.trackId),
        gt(qualifiedStreams.qualifiedAt, duplicateCutoff),
        inArray(qualifiedStreams.status, ["qualified", "held"])
      )
    )
    .limit(1);

  if (recentQualified) {
    return { result: "duplicate" as PlaybackQualificationResult };
  }

  const accountingPeriodId = await getOrCreateAccountingPeriod({
    configurationVersionId: config.id,
    currency: config.currency,
    db,
    now,
  });
  const qualifiedStreamId = crypto.randomUUID();
  const windowKey = qualificationWindowKey({
    deduplicationWindowHours: config.deduplicationWindowHours,
    occurredAt: now,
  });

  await db
    .insert(qualifiedStreams)
    .values({
      accountingPeriodId,
      configurationVersionId: config.id,
      id: qualifiedStreamId,
      ownerUserId: track.ownerUserId,
      playbackSessionId: input.sessionId,
      qualificationWindowKey: windowKey,
      qualifiedAt: now,
      ruleVersion: config.version,
      sourceId: session.sourceId,
      sourceType: session.sourceType,
      status: "qualified",
      trackId: input.trackId,
      userId: input.listenerUserId,
    })
    .onConflictDoNothing();

  const [qualified] = await db
    .select({ id: qualifiedStreams.id })
    .from(qualifiedStreams)
    .where(eq(qualifiedStreams.playbackSessionId, input.sessionId))
    .limit(1);

  if (!qualified) {
    return { result: "duplicate" as PlaybackQualificationResult };
  }

  await db
    .insert(rewardUnits)
    .values({
      accountingPeriodId,
      artistUserId: track.ownerUserId,
      configurationVersionId: config.id,
      currency: config.currency,
      id: crypto.randomUUID(),
      occurredAt: now,
      qualifiedStreamId: qualified.id,
      quantity: 1,
      sourceId: session.sourceId,
      sourceType: session.sourceType,
      status: "eligible",
      trackId: input.trackId,
      unitType: "premium_track_stream",
      userId: input.listenerUserId,
      weightBasisPoints: 10_000,
    })
    .onConflictDoNothing();

  return {
    qualifiedStreamId: qualified.id,
    result: "qualified" as PlaybackQualificationResult,
  };
};

export const recordLiveSessionTrackPlayback = async ({
  db,
  experienceId,
  kind,
  listenerUserIds,
  playedSeconds,
  trackId,
}: {
  db: SoundKitDb;
  experienceId: string;
  kind: "live_battle" | "live_stream" | "listening_party";
  listenerUserIds: string[];
  playedSeconds: number;
  trackId: string;
}) => {
  const results: {
    listenerUserId: string;
    result: PlaybackQualificationResult;
  }[] = [];

  const sourceType =
    kind === "live_battle"
      ? "battle"
      : (kind === "live_stream"
        ? "vod"
        : "listening_party");

  for (const listenerUserId of listenerUserIds) {
    const session = await createTrackPlaybackSession({
      db,
      input: {
        entitlementSnapshot: {
          activePlanCode: "soundkit_premium_artist",
          isPremium: true,
          status: "active",
        },
        listenerUserId,
        sourceId: experienceId,
        sourceType,
        trackId,
      },
    });

    if (session) {
      const progress = await recordPlaybackProgress({
        db,
        input: {
          durationSeconds: session.durationSeconds ?? playedSeconds,
          ended: true,
          listenerUserId,
          playedSeconds,
          sessionId: session.id,
          trackId,
        },
      });
      results.push({ listenerUserId, result: progress.result });
    }
  }

  return results;
};
