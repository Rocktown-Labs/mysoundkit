/* eslint-disable complexity, unicorn/max-nested-calls, sort-vars, one-var, no-nested-ternary, unicorn/no-nested-ternary, unicorn/no-await-expression-member, unicorn/no-negated-condition, unicorn/prefer-number-properties, unicorn/prefer-ternary, no-shadow */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  battleChallenges,
  battleKitTracks,
  battleKits,
  battleParticipations,
  battleQueueEntries,
  battleRounds,
  battleStats,
  battles,
  genres,
  liveExperiences,
  trackAssets,
  videos,
  trackLyrics,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { publicAssetUrlFromParts } from "@/lib/asset-urls";
import {
  getBattleChallengeExpiresAt,
  getBattleChallengeExpiryCutoff,
  hasBattleChallengeExpired,
} from "@/lib/battle-challenge-lifecycle";
import {
  battleHasPlayedTurn,
  formatArtistBattleTitle,
  isDurableReplayPlaybackUrl,
  rankFeaturedBattleIds,
  resolveArtistBattleTitle,
  resolveBattleReplayStatus,
} from "@/lib/battle-display";
import {
  dedupeBattleKitTracks,
  evaluateBattleKitReadiness,
  validateBattleKitTracks,
} from "@/lib/battle-kits";
import {
  forbiddenMessage,
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { canonicalGenreName, canonicalGenreSlug } from "@/lib/genre-catalog";
import { notify } from "@/lib/notifications";
import { profileRegionCondition } from "@/lib/public-explore";
import { sampleBattles } from "@/lib/sample-data";
import {
  battleEligibilityBodySchema,
  battleEligibilitySchema,
  battleChallengesResponseSchema,
  battleKitQuerySchema,
  battleKitSchema,
  battleRecordResponseSchema,
  createBattleKitBodySchema,
  updateBattleKitBodySchema,
  battleSummarySchema,
  createChallengeBodySchema,
  messageResponseSchema,
  publicExploreQuerySchema,
  updateBattleChallengeBodySchema,
} from "@/lib/schemas";
import { resolveTrackAssetFromRows } from "@/lib/track-asset-resolver";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>();

app.get("/directory/ws", async (c) => {
  if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
    return c.json(
      { message: "Expected WebSocket upgrade." },
      HttpStatusCodes.UPGRADE_REQUIRED
    );
  }
  if (!c.env.BATTLE_DIRECTORY) {
    return c.json(
      { message: "Battle directory WebSocket is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  return c.env.BATTLE_DIRECTORY.getByName("public").fetch(
    new Request("https://battle-directory.soundkit.internal/ws", {
      headers: { upgrade: "websocket" },
      method: "GET",
    })
  );
});

const featuredBattleLimit = 6,
  battleTotalRoundsByFormat = {
    best_of_3: 3,
    best_of_5: 5,
    best_of_7: 7,
  } as const;

interface BattleFeedRow {
  challengerArtistUserId: string | null;
  endedAt: Date | null;
  format: "best_of_3" | "best_of_5" | "best_of_7";
  genre: string;
  id: string;
  opponentArtistUserId: string | null;
  outcome: "canceled" | "ducked" | "forfeited" | "quit" | null;
  replayVideoId: string | null;
  startsAt: Date | null;
  status: "scheduled" | "live" | "completed" | "archived";
  title: string;
  viewerCount: number;
  visibility: "public" | "premium_only";
}

interface BattleFeedRound {
  battleId: string;
  id: string;
  isTiebreaker: boolean;
  roundNumber: number;
  status: "upcoming" | "active" | "completed";
  trackOneId: null | string;
  trackOneVotes: number;
  trackTwoId: null | string;
  trackTwoVotes: number;
  votingEndsAt: Date | null;
}

interface BattleFeedTrack {
  artist: string;
  cover: null | string;
  id: string;
  title: string;
}

const selectCurrentRound = (rounds: BattleFeedRound[]) =>
    rounds.find((round) => round.status === "active") ??
    rounds.find((round) => round.status === "upcoming") ??
    rounds.at(-1) ??
    null,
  enrichBattleFeedRows = async (battleRows: BattleFeedRow[]) => {
    if (battleRows.length === 0) {
      return [];
    }

    const db = createDb(),
      battleIds = battleRows.map((battle) => battle.id),
      replayVideoIds = battleRows
        .map((battle) => battle.replayVideoId)
        .filter((videoId): videoId is string => Boolean(videoId)),
      [roundRows, queueRows, experienceRows, replayVideoRows] =
        await Promise.all([
          db
            .select({
              battleId: battleRounds.battleId,
              id: battleRounds.id,
              isTiebreaker: battleRounds.isTiebreaker,
              roundNumber: battleRounds.roundNumber,
              status: battleRounds.status,
              trackOneId: battleRounds.trackOneId,
              trackOneVotes: battleRounds.trackOneVotes,
              trackTwoId: battleRounds.trackTwoId,
              trackTwoVotes: battleRounds.trackTwoVotes,
              votingEndsAt: battleRounds.votingEndsAt,
            })
            .from(battleRounds)
            .where(inArray(battleRounds.battleId, battleIds))
            .orderBy(asc(battleRounds.roundNumber)),
          db
            .select({
              battleId: battleQueueEntries.battleId,
              queueSize: sql<number>`count(*)::int`,
            })
            .from(battleQueueEntries)
            .where(
              and(
                inArray(battleQueueEntries.battleId, battleIds),
                or(
                  eq(battleQueueEntries.status, "queued"),
                  eq(battleQueueEntries.status, "conflict")
                )
              )
            )
            .groupBy(battleQueueEntries.battleId),
          db
            .select({
              battleId: liveExperiences.battleId,
              recordingStatus: liveExperiences.recordingStatus,
              replayPublishedAt: liveExperiences.replayPublishedAt,
              startedAt: liveExperiences.startedAt,
            })
            .from(liveExperiences)
            .where(inArray(liveExperiences.battleId, battleIds)),
          replayVideoIds.length > 0
            ? db
                .select({
                  externalPlaybackUrl: videos.externalPlaybackUrl,
                  id: videos.id,
                  isPublic: videos.isPublic,
                  publishedAt: videos.publishedAt,
                  status: videos.status,
                  videoKind: videos.videoKind,
                })
                .from(videos)
                .where(inArray(videos.id, replayVideoIds))
            : [],
        ]),
      queueSizeByBattleId = new Map(
        queueRows.map((row) => [row.battleId, row.queueSize])
      ),
      roundsByBattleId = new Map<string, BattleFeedRound[]>(),
      experienceByBattleId = new Map<string, (typeof experienceRows)[number]>();

    for (const round of roundRows) {
      const rounds = roundsByBattleId.get(round.battleId) ?? [];
      rounds.push(round);
      roundsByBattleId.set(round.battleId, rounds);
    }

    for (const experience of experienceRows) {
      if (!experience.battleId) {
        continue;
      }

      const existing = experienceByBattleId.get(experience.battleId);
      if (!existing || experience.replayPublishedAt || experience.startedAt) {
        experienceByBattleId.set(experience.battleId, experience);
      }
    }

    const replayVideoById = new Map(
        replayVideoRows.map((video) => [video.id, video])
      ),
      participantIds = [
        ...new Set(
          battleRows
            .flatMap((battle) => [
              battle.challengerArtistUserId,
              battle.opponentArtistUserId,
            ])
            .filter((userId): userId is string => Boolean(userId))
        ),
      ],
      participantRows =
        participantIds.length > 0
          ? await db
              .select({
                avatarUrl: userProfiles.avatarUrl,
                displayName: userProfiles.displayName,
                id: userProfiles.userId,
                username: userProfiles.username,
              })
              .from(userProfiles)
              .where(inArray(userProfiles.userId, participantIds))
          : [],
      participantById = new Map(
        participantRows.map((participant) => [participant.id, participant])
      ),
      trackIds = [
        ...new Set(
          roundRows
            .flatMap((round) => [round.trackOneId, round.trackTwoId])
            .filter((trackId): trackId is string => Boolean(trackId))
        ),
      ],
      trackById = new Map<string, BattleFeedTrack>();

    if (trackIds.length > 0) {
      const [trackRows, coverRows] = await Promise.all([
          db
            .select({
              artistName: userProfiles.displayName,
              id: tracks.id,
              title: tracks.title,
            })
            .from(tracks)
            .leftJoin(userProfiles, eq(userProfiles.userId, tracks.ownerUserId))
            .where(inArray(tracks.id, trackIds)),
          db
            .select({
              metadata: trackAssets.metadata,
              objectKey: trackAssets.objectKey,
              trackId: trackAssets.trackId,
            })
            .from(trackAssets)
            .where(
              and(
                inArray(trackAssets.trackId, trackIds),
                eq(trackAssets.assetKind, "cover_art")
              )
            ),
        ]),
        coverByTrackId = new Map(
          coverRows.map((asset) => [
            asset.trackId,
            publicAssetUrlFromParts(asset),
          ])
        );

      for (const track of trackRows) {
        trackById.set(track.id, {
          artist: track.artistName ?? "SoundKit Artist",
          cover: coverByTrackId.get(track.id) ?? null,
          id: track.id,
          title: track.title,
        });
      }
    }

    return battleRows.map((battle) => {
      const rounds = roundsByBattleId.get(battle.id) ?? [],
        currentRound = selectCurrentRound(rounds),
        experience = experienceByBattleId.get(battle.id),
        replayVideo = battle.replayVideoId
          ? replayVideoById.get(battle.replayVideoId)
          : undefined,
        hasPlayedTurn = battleHasPlayedTurn({
          experienceStartedAt: experience?.startedAt,
          outcome: battle.outcome,
          roundStatuses: rounds.map((round) => round.status),
        }),
        participants = [
          battle.challengerArtistUserId,
          battle.opponentArtistUserId,
        ].flatMap((userId) => {
          if (!userId) {
            return [];
          }

          const participant = participantById.get(userId);
          return [
            {
              avatarUrl: participant?.avatarUrl ?? null,
              id: userId,
              name: participant?.displayName ?? "SoundKit Artist",
              username: participant?.username ?? null,
            },
          ];
        }),
        roundTracks = currentRound
          ? [
              currentRound.trackOneId
                ? {
                    ...trackById.get(currentRound.trackOneId),
                    votes: currentRound.trackOneVotes,
                  }
                : null,
              currentRound.trackTwoId
                ? {
                    ...trackById.get(currentRound.trackTwoId),
                    votes: currentRound.trackTwoVotes,
                  }
                : null,
            ].filter(
              (
                track
              ): track is BattleFeedTrack & {
                votes: number;
              } => Boolean(track?.id)
            )
          : [];

      return {
        ...battle,
        hasPlayedTurn,
        joinMode:
          battle.status === "live" && currentRound?.status === "active"
            ? ("waiting_room" as const)
            : ("watch_now" as const),
        participants,
        phaseEndsAt: currentRound?.votingEndsAt?.toISOString() ?? null,
        queueSize: queueSizeByBattleId.get(battle.id) ?? 0,
        replayStatus: resolveBattleReplayStatus({
          recordingStatus: experience?.recordingStatus,
          replayPublishedAt: experience?.replayPublishedAt,
          replayVideoAvailable: Boolean(
            replayVideo?.isPublic &&
            replayVideo.publishedAt &&
            replayVideo.status === "ready" &&
            replayVideo.videoKind === "battle_replay" &&
            isDurableReplayPlaybackUrl(replayVideo.externalPlaybackUrl)
          ),
        }),
        replayVideoId: battle.replayVideoId,
        round: currentRound
          ? {
              current: currentRound.roundNumber,
              id: currentRound.id,
              isVoting: currentRound.status === "active",
              status: currentRound.status,
              total: battleTotalRoundsByFormat[battle.format],
            }
          : null,
        startsAt: battle.startsAt?.toISOString() ?? null,
        title: resolveArtistBattleTitle(battle.title, battle.genre),
        tracks: roundTracks,
      };
    });
  },
  rankFeaturedBattles = (
    battleRows: Awaited<ReturnType<typeof enrichBattleFeedRows>>
  ) => {
    const featuredIds = rankFeaturedBattleIds(battleRows, featuredBattleLimit);

    return battleRows.map((battle) => {
      const featuredRank = featuredIds.get(battle.id) ?? null;
      return {
        ...battle,
        featuredRank,
        isFeatured: featuredRank !== null,
      };
    });
  };

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    request: { query: publicExploreQuerySchema.partial() },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        battleSummarySchema.array(),
        "Battles feed"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const query = c.req.valid("query");

    if (!isDatabaseConfigured()) {
      const sampleRows = sampleBattles.map((battle) => ({
        ...battle,
        hasPlayedTurn: battle.status === "live",
        replayStatus: "none" as const,
        replayVideoId: null,
      }));
      return c.json(
        query.scope === "public"
          ? sampleRows.filter(
              (battle) =>
                battle.status === "live" || battle.status === "scheduled"
            )
          : sampleRows,
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      regionCondition = profileRegionCondition(query),
      rows = await db
        .select({
          challengerArtistUserId: battles.challengerArtistUserId,
          endedAt: battles.endedAt,
          format: battles.format,
          genre: genres.name,
          id: battles.id,
          opponentArtistUserId: battles.opponentArtistUserId,
          outcome: battles.outcome,
          replayVideoId: battles.replayVideoId,
          startsAt: battles.startsAt,
          status: battles.status,
          title: battles.title,
          viewerCount: battles.viewerCount,
          visibility: battles.visibility,
        })
        .from(battles)
        .leftJoin(genres, eq(genres.id, battles.genreId))
        .where(
          and(
            regionCondition
              ? sql`exists (
                select 1 from ${userProfiles}
                where ${userProfiles.userId} in (
                  ${battles.challengerArtistUserId},
                  ${battles.opponentArtistUserId}
                ) and ${regionCondition}
              )`
              : undefined
          )
        )
        .orderBy(desc(battles.viewerCount))
        .limit(50),
      enrichedRows = await enrichBattleFeedRows(
        rows.map((row) => ({
          ...row,
          genre: row.genre ? canonicalGenreName(row.genre) : "Uncategorized",
        }))
      ),
      visibleRows =
        query.scope === "public"
          ? enrichedRows.filter(
              (battle) =>
                battle.status === "live" ||
                battle.status === "scheduled" ||
                (battle.hasPlayedTurn && battle.replayStatus === "available")
            )
          : enrichedRows;

    return c.json(rankFeaturedBattles(visibleRows), HttpStatusCodes.OK);
  }
);

const escapeXml = (unsafe: string): string =>
  unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export interface BattleOgParams {
  genre?: string | null;
  p1Image?: string | null;
  p1Name?: string | null;
  p2Image?: string | null;
  p2Name?: string | null;
  status?: string | null;
  title?: string | null;
}

export const generateBattleOgSvg = ({
  genre,
  p1Image,
  p1Name,
  p2Image,
  p2Name,
  status,
  title,
}: BattleOgParams): string => {
  const name1 = escapeXml(p1Name?.trim() || "Producer 1"),
    name2 = escapeXml(p2Name?.trim() || "Producer 2"),
    isLive = status === "live",
    statusBadge = isLive ? "LIVE NOW" : "SCHEDULED BATTLE",
    genreBadge = escapeXml(
      genre?.toUpperCase() || (title ? title.toUpperCase() : "BEAT BATTLE")
    ),
    initials1 = escapeXml(name1.slice(0, 2).toUpperCase()),
    initials2 = escapeXml(name2.slice(0, 2).toUpperCase()),
    safeImage1 = p1Image ? escapeXml(p1Image) : null,
    safeImage2 = p2Image ? escapeXml(p2Image) : null;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#08090E" />
      <stop offset="50%" stop-color="#0F111A" />
      <stop offset="100%" stop-color="#07080C" />
    </linearGradient>
    <radialGradient id="glow-left" cx="25%" cy="35%" r="40%">
      <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glow-right" cx="75%" cy="35%" r="40%">
      <stop offset="0%" stop-color="#EC4899" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#EC4899" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="vs-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#F43F5E" stop-opacity="0.5" />
      <stop offset="100%" stop-color="#F43F5E" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="vs-badge" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F43F5E" />
      <stop offset="100%" stop-color="#BE123C" />
    </linearGradient>
    <clipPath id="avatar-left-clip">
      <circle cx="280" cy="245" r="95" />
    </clipPath>
    <clipPath id="avatar-right-clip">
      <circle cx="920" cy="245" r="95" />
    </clipPath>
  </defs>

  <!-- Background Base -->
  <rect width="1200" height="630" fill="url(#bg)" />

  <!-- Ambient Glow Orbs -->
  <circle cx="280" cy="245" r="280" fill="url(#glow-left)" />
  <circle cx="920" cy="245" r="280" fill="url(#glow-right)" />
  <circle cx="600" cy="245" r="180" fill="url(#vs-glow)" />

  <!-- Subtle grid lines for studio arena atmosphere -->
  <line x1="0" y1="120" x2="1200" y2="120" stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="1" />
  <line x1="0" y1="460" x2="1200" y2="460" stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="1" />
  <line x1="600" y1="0" x2="600" y2="120" stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="1" />

  <!-- Top Header Bar: SoundKit Brand & Badges -->
  <g transform="translate(60, 42)">
    <text x="0" y="28" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="900" letter-spacing="3">SOUNDKIT</text>
    <text x="142" y="28" fill="#8B5CF6" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="900">.LIVE</text>

    <!-- SoundKit Premium pill badge -->
    <rect x="235" y="8" width="168" height="26" rx="13" fill="#F59E0B" fill-opacity="0.12" stroke="#F59E0B" stroke-opacity="0.4" stroke-width="1" />
    <text x="319" y="25" text-anchor="middle" fill="#FBBF24" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" letter-spacing="1.5">★ SOUNDKIT PREMIUM</text>

    <!-- Match Status badge -->
    <rect x="910" y="8" width="170" height="26" rx="13" fill="${isLive ? "#EF4444" : "#3B82F6"}" fill-opacity="0.15" stroke="${isLive ? "#EF4444" : "#3B82F6"}" stroke-opacity="0.4" stroke-width="1" />
    ${isLive ? '<circle cx="928" cy="21" r="4" fill="#EF4444" />' : ""}
    <text x="${isLive ? "1002" : "995"}" y="25" text-anchor="middle" fill="${isLive ? "#F87171" : "#60A5FA"}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" letter-spacing="1.5">${statusBadge}</text>
  </g>

  <!-- LEFT PARTICIPANT -->
  <g>
    <circle cx="280" cy="245" r="103" fill="none" stroke="#8B5CF6" stroke-width="3" stroke-opacity="0.6" />
    <circle cx="280" cy="245" r="95" fill="#1E1338" />
    ${
      safeImage1
        ? `<image href="${safeImage1}" x="185" y="150" width="190" height="190" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-left-clip)" />`
        : `<text x="280" y="263" text-anchor="middle" fill="#A78BFA" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="800">${initials1}</text>`
    }
    <text x="280" y="375" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="800">${name1}</text>
    <rect x="220" y="390" width="120" height="22" rx="11" fill="#8B5CF6" fill-opacity="0.15" stroke="#8B5CF6" stroke-opacity="0.3" stroke-width="1" />
    <text x="280" y="405" text-anchor="middle" fill="#C4B5FD" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" letter-spacing="1">PRODUCER</text>
  </g>

  <!-- CENTER VS BADGE -->
  <g transform="translate(600, 245)">
    <circle cx="0" cy="0" r="48" fill="#151722" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="2" />
    <circle cx="0" cy="0" r="40" fill="url(#vs-badge)" />
    <text x="0" y="12" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="900" font-style="italic" letter-spacing="1">VS</text>

    <!-- Genre tag pill below VS -->
    <rect x="-65" y="62" width="130" height="24" rx="12" fill="#FFFFFF" fill-opacity="0.08" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="1" />
    <text x="0" y="78" text-anchor="middle" fill="#E2E8F0" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="800" letter-spacing="1.5">${genreBadge}</text>
  </g>

  <!-- RIGHT PARTICIPANT -->
  <g>
    <circle cx="920" cy="245" r="103" fill="none" stroke="#EC4899" stroke-width="3" stroke-opacity="0.6" />
    <circle cx="920" cy="245" r="95" fill="#3B0B24" />
    ${
      safeImage2
        ? `<image href="${safeImage2}" x="825" y="150" width="190" height="190" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-right-clip)" />`
        : `<text x="920" y="263" text-anchor="middle" fill="#F472B6" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="800">${initials2}</text>`
    }
    <text x="920" y="375" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="800">${name2}</text>
    <rect x="860" y="390" width="120" height="22" rx="11" fill="#EC4899" fill-opacity="0.15" stroke="#EC4899" stroke-opacity="0.3" stroke-width="1" />
    <text x="920" y="405" text-anchor="middle" fill="#FBCFE8" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" letter-spacing="1">PRODUCER</text>
  </g>

  <!-- BOTTOM CARD: Conversion-tuned headline & subtitle -->
  <g transform="translate(140, 465)">
    <rect width="920" height="120" rx="24" fill="#12131D" fill-opacity="0.8" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="1" />
    <text x="460" y="48" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="800">Watch ${name1} battle ${name2} live on SoundKit Premium</text>
    <text x="460" y="82" text-anchor="middle" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" letter-spacing="0.5">Live Beat Battle • Real-Time Audience Voting • Unreleased Beats</text>
  </g>
</svg>`;
};

app.get("/og-image", (c) => {
  const p1Name = c.req.query("p1") || null,
    p2Name = c.req.query("p2") || null,
    p1Image = c.req.query("img1") || null,
    p2Image = c.req.query("img2") || null,
    title = c.req.query("title") || null,
    genre = c.req.query("genre") || null,
    status = c.req.query("status") || "live",
    svg = generateBattleOgSvg({
      genre,
      p1Image,
      p1Name,
      p2Image,
      p2Name,
      status,
      title,
    });

  return c.body(svg, HttpStatusCodes.OK, {
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
    "Content-Type": "image/svg+xml; charset=utf-8",
  });
});

app.get("/:battleId/og-image", async (c) => {
  const battleId = c.req.param("battleId");
  let p1Name = c.req.query("p1") || null,
    p2Name = c.req.query("p2") || null,
    p1Image = c.req.query("img1") || null,
    p2Image = c.req.query("img2") || null,
    title = c.req.query("title") || null,
    genre = c.req.query("genre") || null,
    status = c.req.query("status") || "live";

  if (isDatabaseConfigured() && (!p1Name || !p2Name)) {
    try {
      const db = createDb(),
        [battleRow] = await db
          .select({
            challengerArtistUserId: battles.challengerArtistUserId,
            genre: genres.name,
            id: battles.id,
            opponentArtistUserId: battles.opponentArtistUserId,
            status: battles.status,
            title: battles.title,
          })
          .from(battles)
          .leftJoin(genres, eq(genres.id, battles.genreId))
          .where(
            or(eq(battles.id, battleId), eq(battles.externalBattleId, battleId))
          )
          .limit(1);

      if (battleRow) {
        title ||= battleRow.title;
        status ||= battleRow.status;
        genre ||= battleRow.genre || null;

        const userIds = [
          battleRow.challengerArtistUserId,
          battleRow.opponentArtistUserId,
        ].filter((id): id is string => Boolean(id));

        if (userIds.length > 0) {
          const profileRows = await db
              .select({
                avatarUrl: userProfiles.avatarUrl,
                displayName: userProfiles.displayName,
                userId: userProfiles.userId,
                username: userProfiles.username,
              })
              .from(userProfiles)
              .where(inArray(userProfiles.userId, userIds)),
            profileMap = new Map(profileRows.map((r) => [r.userId, r])),
            p1Profile = battleRow.challengerArtistUserId
              ? profileMap.get(battleRow.challengerArtistUserId)
              : null,
            p2Profile = battleRow.opponentArtistUserId
              ? profileMap.get(battleRow.opponentArtistUserId)
              : null;

          if (p1Profile && !p1Name) {
            p1Name =
              p1Profile.displayName || p1Profile.username || "Producer 1";
            p1Image ||= p1Profile.avatarUrl;
          }
          if (p2Profile && !p2Name) {
            p2Name =
              p2Profile.displayName || p2Profile.username || "Producer 2";
            p2Image ||= p2Profile.avatarUrl;
          }
        }
      }
    } catch {
      // Fall through to query params or defaults
    }
  }

  const svg = generateBattleOgSvg({
    genre,
    p1Image,
    p1Name,
    p2Image,
    p2Name,
    status,
    title,
  });

  return c.body(svg, HttpStatusCodes.OK, {
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
    "Content-Type": "image/svg+xml; charset=utf-8",
  });
});

app.get("/:battleId/public", async (c) => {
  const battleId = c.req.param("battleId");
  if (!isDatabaseConfigured()) {
    const sample = sampleBattles.find((b) => b.id === battleId);
    if (!sample) {
      return c.json({ message: "Battle not found" }, HttpStatusCodes.NOT_FOUND);
    }
    return c.json(
      {
        format: sample.format,
        genre: sample.genre,
        id: sample.id,
        participants: [
          { avatarUrl: null, id: "p1", name: "Artist One", username: null },
          { avatarUrl: null, id: "p2", name: "Artist Two", username: null },
        ],
        startsAt: sample.startsAt ? String(sample.startsAt) : null,
        status: sample.status,
        title: sample.title,
      },
      HttpStatusCodes.OK
    );
  }

  const db = createDb(),
    [battleRow] = await db
      .select({
        challengerArtistUserId: battles.challengerArtistUserId,
        format: battles.format,
        genre: genres.name,
        id: battles.id,
        opponentArtistUserId: battles.opponentArtistUserId,
        startsAt: battles.startsAt,
        status: battles.status,
        title: battles.title,
      })
      .from(battles)
      .leftJoin(genres, eq(genres.id, battles.genreId))
      .where(
        or(eq(battles.id, battleId), eq(battles.externalBattleId, battleId))
      )
      .limit(1);

  if (!battleRow) {
    return c.json({ message: "Battle not found" }, HttpStatusCodes.NOT_FOUND);
  }

  const userIds = [
      battleRow.challengerArtistUserId,
      battleRow.opponentArtistUserId,
    ].filter((id): id is string => Boolean(id)),
    participants: {
      avatarUrl: string | null;
      id: string;
      name: string;
      username: string | null;
    }[] = [];

  if (userIds.length > 0) {
    const profileRows = await db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          displayName: userProfiles.displayName,
          userId: userProfiles.userId,
          username: userProfiles.username,
        })
        .from(userProfiles)
        .where(inArray(userProfiles.userId, userIds)),
      profileMap = new Map(profileRows.map((r) => [r.userId, r]));

    for (const uid of userIds) {
      const p = profileMap.get(uid);
      if (p) {
        participants.push({
          avatarUrl: p.avatarUrl,
          id: p.userId,
          name: p.displayName || p.username || "Producer",
          username: p.username,
        });
      }
    }
  }

  const formattedStartsAt =
    battleRow.startsAt instanceof Date
      ? battleRow.startsAt.toISOString()
      : battleRow.startsAt
        ? String(battleRow.startsAt)
        : null;

  return c.json(
    {
      format: battleRow.format,
      genre: battleRow.genre ?? null,
      id: battleRow.id,
      participants,
      startsAt: formattedStartsAt,
      status: battleRow.status,
      title: battleRow.title,
    },
    HttpStatusCodes.OK
  );
});

app.openapi(
  createRoute({
    method: "delete",
    path: "/{battleId}",
    request: {
      params: z.object({
        battleId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Scheduled battle deleted"
      ),
      [HttpStatusCodes.CONFLICT]: jsonContent(
        messageResponseSchema,
        "Battle cannot be deleted"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Battle not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Battle not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const { battleId } = c.req.valid("param"),
      db = createDb(),
      [battle] = await db
        .select({
          challengerArtistUserId: battles.challengerArtistUserId,
          externalBattleId: battles.externalBattleId,
          opponentArtistUserId: battles.opponentArtistUserId,
          status: battles.status,
        })
        .from(battles)
        .where(eq(battles.id, battleId))
        .limit(1);

    if (
      !battle ||
      (battle.challengerArtistUserId !== user.id &&
        battle.opponentArtistUserId !== user.id)
    ) {
      return c.json(
        { message: "Battle not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    if (battle.status !== "scheduled") {
      return c.json(
        { message: "Only scheduled battles can be deleted." },
        HttpStatusCodes.CONFLICT
      );
    }

    const [deletedBattle] = await db
      .delete(battles)
      .where(
        and(
          eq(battles.id, battleId),
          eq(battles.status, "scheduled"),
          or(
            eq(battles.challengerArtistUserId, user.id),
            eq(battles.opponentArtistUserId, user.id)
          )
        )
      )
      .returning({ externalBattleId: battles.externalBattleId });

    if (!deletedBattle) {
      return c.json(
        { message: "Battle is no longer scheduled." },
        HttpStatusCodes.CONFLICT
      );
    }

    const challengeId = deletedBattle.externalBattleId?.startsWith("challenge:")
      ? deletedBattle.externalBattleId.slice("challenge:".length)
      : null;
    if (challengeId) {
      await db
        .update(battleChallenges)
        .set({
          status: "canceled",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(battleChallenges.id, challengeId),
            eq(battleChallenges.status, "accepted")
          )
        );
    }

    return c.json({ message: "Scheduled battle deleted." }, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/eligibility",
    request: {
      body: jsonContentRequired(
        battleEligibilityBodySchema,
        "Battle track eligibility payload"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        battleEligibilitySchema,
        "Battle track eligibility"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const { trackIds } = c.req.valid("json");

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          eligible: false,
          tracks: trackIds.map((trackId) => ({
            lyricsRevisionId: null,
            ready: false,
            reason: "Database is not configured.",
            trackId,
          })),
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      });
    if (trackIds.length === 0) {
      return c.json(
        {
          eligible: true,
          tracks: [],
        },
        HttpStatusCodes.OK
      );
    }

    const [ownedTracks, approvedLyricsRows, mediaAssetRows] = await Promise.all(
        [
          db
            .select({ id: tracks.id })
            .from(tracks)
            .where(
              and(
                inArray(tracks.id, trackIds),
                organizationId
                  ? eq(tracks.organizationId, organizationId)
                  : eq(tracks.ownerUserId, user.id)
              )
            ),
          db
            .select({
              id: trackLyrics.id,
              timedLines: trackLyrics.timedLines,
              trackId: trackLyrics.trackId,
            })
            .from(trackLyrics)
            .where(
              and(
                inArray(trackLyrics.trackId, trackIds),
                eq(trackLyrics.status, "approved")
              )
            ),
          db
            .select()
            .from(trackAssets)
            .where(
              and(
                inArray(trackAssets.trackId, trackIds),
                eq(trackAssets.isCurrent, true)
              )
            ),
        ]
      ),
      ownedTrackIds = new Set(ownedTracks.map((track) => track.id)),
      approvedLyricsByTrackId = new Map<
        string,
        { id: string; timedLines: typeof trackLyrics.$inferSelect.timedLines }
      >();

    for (const approvedLyrics of approvedLyricsRows) {
      if (!approvedLyricsByTrackId.has(approvedLyrics.trackId)) {
        approvedLyricsByTrackId.set(approvedLyrics.trackId, {
          id: approvedLyrics.id,
          timedLines: approvedLyrics.timedLines,
        });
      }
    }

    const readiness = trackIds.map((trackId) => {
      if (!ownedTrackIds.has(trackId)) {
        return {
          lyricsRevisionId: null,
          ready: false,
          reason: "Track was not found.",
          trackId,
        };
      }

      const approvedLyrics = approvedLyricsByTrackId.get(trackId),
        hasSynchronizedLyrics = (approvedLyrics?.timedLines?.length ?? 0) > 0,
        battleAsset = resolveTrackAssetFromRows({
          allowLegacyFallback: true,
          assets: mediaAssetRows.filter((asset) => asset.trackId === trackId),
          purpose: "battle",
          trackId,
        }),
        ready = hasSynchronizedLyrics && Boolean(battleAsset);

      return {
        lyricsRevisionId: approvedLyrics?.id ?? null,
        ready,
        reason: !hasSynchronizedLyrics
          ? "Approved synchronized lyrics are required for battle tracks."
          : !battleAsset
            ? "SoundKit battle audio is still processing."
            : null,
        trackId,
      };
    });

    return c.json(
      {
        eligible: readiness.every((track) => track.ready),
        tracks: readiness,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/opponents",
    request: {
      query: z.object({
        genre: z.string().optional(),
        q: z.string().trim().max(120).default(""),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.array(
          z.object({
            genre: z.string().nullable(),
            name: z.string(),
            username: z.string(),
          })
        ),
        "Premium battle opponents"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    const { genre, q } = c.req.valid("query"),
      normalizedQuery = q.replace(/^@+/u, ""),
      searchPattern = `%${normalizedQuery.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`,
      candidates = await createDb()
        .select({
          genre: genres.slug,
          name: userProfiles.displayName,
          userId: userProfiles.userId,
          username: userProfiles.username,
        })
        .from(userProfiles)
        .innerJoin(
          artistProfiles,
          eq(artistProfiles.userId, userProfiles.userId)
        )
        .leftJoin(genres, eq(genres.id, artistProfiles.primaryGenreId))
        .where(
          and(
            eq(userProfiles.accountType, "artist"),
            normalizedQuery
              ? or(
                  ilike(userProfiles.displayName, searchPattern),
                  ilike(userProfiles.username, searchPattern)
                )
              : undefined,
            genre ? eq(genres.slug, canonicalGenreSlug(genre)) : undefined
          )
        )
        .limit(12),
      eligibleCandidates = await Promise.all(
        candidates
          .filter((candidate) => candidate.userId !== user.id)
          .map(async (candidate) => ({
            candidate,
            entitlements: await resolveEntitlements({
              session: null,
              user: { id: candidate.userId },
            }),
          }))
      );

    return c.json(
      eligibleCandidates
        .filter(({ candidate, entitlements }) =>
          Boolean(
            entitlements.canCreateLiveBattles &&
            candidate.name &&
            candidate.username
          )
        )
        .map(({ candidate }) => ({
          genre: candidate.genre,
          name: candidate.name ?? "SoundKit Artist",
          username: candidate.username ?? "artist",
        })),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/challenges",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        battleChallengesResponseSchema,
        "Battle challenges"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json({ incoming: [], outgoing: [] }, HttpStatusCodes.OK);
    }

    const db = createDb(),
      now = new Date();

    await db
      .update(battleChallenges)
      .set({
        status: "expired",
        updatedAt: now,
      })
      .where(
        and(
          eq(battleChallenges.status, "pending"),
          lte(battleChallenges.createdAt, getBattleChallengeExpiryCutoff(now))
        )
      );

    const rows = await db
        .select({
          challengerUserId: battleChallenges.challengerUserId,
          createdAt: battleChallenges.createdAt,
          format: battleChallenges.format,
          genre: genres.name,
          id: battleChallenges.id,
          message: battleChallenges.message,
          opponentArtistUserId: battleChallenges.opponentArtistUserId,
          opponentUsernameSnapshot: battleChallenges.opponentUsernameSnapshot,
          proposedDate: battleChallenges.proposedDate,
          proposedTimeLabel: battleChallenges.proposedTimeLabel,
          status: battleChallenges.status,
        })
        .from(battleChallenges)
        .leftJoin(genres, eq(genres.id, battleChallenges.genreId))
        .where(
          or(
            eq(battleChallenges.challengerUserId, user.id),
            eq(battleChallenges.opponentArtistUserId, user.id)
          )
        )
        .orderBy(desc(battleChallenges.createdAt)),
      profileIds = [
        ...new Set(
          rows
            .flatMap((row) => [row.challengerUserId, row.opponentArtistUserId])
            .filter((id): id is string => Boolean(id))
        ),
      ],
      profiles =
        profileIds.length > 0
          ? await db
              .select({
                userId: userProfiles.userId,
                username: userProfiles.username,
              })
              .from(userProfiles)
              .where(inArray(userProfiles.userId, profileIds))
          : [],
      usernameByUserId = new Map(
        profiles.map((profile) => [profile.userId, profile.username])
      ),
      challenges = rows.map((row) => {
        const direction =
          row.opponentArtistUserId === user.id
            ? ("incoming" as const)
            : ("outgoing" as const);

        return {
          challengerUsername:
            usernameByUserId.get(row.challengerUserId) ?? null,
          createdAt: row.createdAt.toISOString(),
          direction,
          expiresAt: getBattleChallengeExpiresAt(row.createdAt).toISOString(),
          format: row.format,
          genre: row.genre ? canonicalGenreName(row.genre) : "Uncategorized",
          id: row.id,
          message: row.message,
          opponentUsername:
            row.opponentUsernameSnapshot ??
            (row.opponentArtistUserId
              ? (usernameByUserId.get(row.opponentArtistUserId) ?? null)
              : null),
          proposedDate: row.proposedDate?.toISOString() ?? null,
          proposedTimeLabel: row.proposedTimeLabel,
          status: row.status,
        };
      });

    return c.json(
      {
        incoming: challenges.filter(
          (challenge) => challenge.direction === "incoming"
        ),
        outgoing: challenges.filter(
          (challenge) => challenge.direction === "outgoing"
        ),
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/challenges/{challengeId}",
    request: {
      body: jsonContentRequired(
        updateBattleChallengeBodySchema,
        "Battle challenge status"
      ),
      params: z.object({
        challengeId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Battle challenge updated"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Battle challenge not found"
      ),
      [HttpStatusCodes.CONFLICT]: jsonContent(
        messageResponseSchema,
        "Battle challenge is no longer pending"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Battle challenge not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const { challengeId } = c.req.valid("param"),
      { status } = c.req.valid("json"),
      db = createDb(),
      [challenge] = await db
        .select({
          challengerUserId: battleChallenges.challengerUserId,
          createdAt: battleChallenges.createdAt,
          format: battleChallenges.format,
          genre: genres.name,
          genreId: battleChallenges.genreId,
          opponentArtistUserId: battleChallenges.opponentArtistUserId,
          proposedDate: battleChallenges.proposedDate,
          status: battleChallenges.status,
        })
        .from(battleChallenges)
        .leftJoin(genres, eq(genres.id, battleChallenges.genreId))
        .where(eq(battleChallenges.id, challengeId))
        .limit(1),
      now = new Date();

    if (!challenge) {
      return c.json(
        { message: "Battle challenge not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    if (
      challenge.status === "pending" &&
      hasBattleChallengeExpired({ createdAt: challenge.createdAt, now })
    ) {
      await db
        .update(battleChallenges)
        .set({
          status: "expired",
          updatedAt: now,
        })
        .where(
          and(
            eq(battleChallenges.id, challengeId),
            eq(battleChallenges.status, "pending")
          )
        );

      return c.json(
        { message: "This battle challenge has expired." },
        HttpStatusCodes.CONFLICT
      );
    }

    const isPending = challenge.status === "pending",
      isIncomingResponse =
        challenge.opponentArtistUserId === user.id &&
        (status === "accepted" || status === "declined"),
      isOutgoingCancellation =
        challenge.challengerUserId === user.id && status === "canceled";

    if (!isPending || (!isIncomingResponse && !isOutgoingCancellation)) {
      return c.json(
        { message: "Battle challenge is no longer pending." },
        HttpStatusCodes.CONFLICT
      );
    }

    const [updatedChallenge] = await db
      .update(battleChallenges)
      .set({
        status,
        updatedAt: now,
      })
      .where(
        and(
          eq(battleChallenges.id, challengeId),
          eq(battleChallenges.status, "pending")
        )
      )
      .returning({ id: battleChallenges.id });

    if (!updatedChallenge) {
      return c.json(
        { message: "Battle challenge is no longer pending." },
        HttpStatusCodes.CONFLICT
      );
    }

    if (status === "accepted" || status === "declined") {
      await notify(
        {
          actorUserId: user.id,
          data: {
            actorName: user.name ?? "An artist",
            challengeId,
          },
          entity: { id: challengeId, type: "battle_challenge" },
          eventId: challengeId,
          recipientUserId: challenge.challengerUserId,
          type:
            status === "accepted"
              ? "battle.challenge.accepted"
              : "battle.challenge.declined",
        },
        { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
      );
    }

    if (
      status === "accepted" &&
      challenge.status !== "accepted" &&
      challenge.opponentArtistUserId
    ) {
      const externalBattleId = `challenge:${challengeId}`,
        [existingBattle] = await db
          .select({ id: battles.id })
          .from(battles)
          .where(eq(battles.externalBattleId, externalBattleId))
          .limit(1);

      if (!existingBattle) {
        await db.insert(battles).values({
          challengerArtistUserId: challenge.challengerUserId,
          externalBattleId,
          format: challenge.format,
          genreId: challenge.genreId,
          id: crypto.randomUUID(),
          opponentArtistUserId: challenge.opponentArtistUserId,
          startsAt: challenge.proposedDate ?? new Date(Date.now() + 86_400_000),
          status: "scheduled",
          title: formatArtistBattleTitle(challenge.genre ?? "Hip Hop"),
          visibility: "public",
        });
      }
    }

    return c.json(
      { message: `Battle challenge ${status}.` },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/challenges/{challengeId}",
    request: {
      params: z.object({
        challengeId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Battle challenge dismissed"
      ),
      [HttpStatusCodes.CONFLICT]: jsonContent(
        messageResponseSchema,
        "Battle challenge cannot be dismissed"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Battle challenge not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Battle challenge not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const { challengeId } = c.req.valid("param"),
      db = createDb(),
      [challenge] = await db
        .select({
          challengerUserId: battleChallenges.challengerUserId,
          opponentArtistUserId: battleChallenges.opponentArtistUserId,
          status: battleChallenges.status,
        })
        .from(battleChallenges)
        .where(eq(battleChallenges.id, challengeId))
        .limit(1);

    if (
      !challenge ||
      (challenge.challengerUserId !== user.id &&
        challenge.opponentArtistUserId !== user.id)
    ) {
      return c.json(
        { message: "Battle challenge not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const dismissibleStatuses = ["canceled", "declined", "expired"] as const;
    if (!dismissibleStatuses.some((status) => status === challenge.status)) {
      return c.json(
        { message: "Only completed challenge requests can be dismissed." },
        HttpStatusCodes.CONFLICT
      );
    }

    const [deletedChallenge] = await db
      .delete(battleChallenges)
      .where(
        and(
          eq(battleChallenges.id, challengeId),
          inArray(battleChallenges.status, dismissibleStatuses),
          or(
            eq(battleChallenges.challengerUserId, user.id),
            eq(battleChallenges.opponentArtistUserId, user.id)
          )
        )
      )
      .returning({ id: battleChallenges.id });

    if (!deletedChallenge) {
      return c.json(
        { message: "Battle challenge is no longer dismissible." },
        HttpStatusCodes.CONFLICT
      );
    }

    return c.json(
      { message: "Battle challenge dismissed." },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/challenge",
    request: {
      body: jsonContentRequired(
        createChallengeBodySchema,
        "Battle challenge payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        messageResponseSchema,
        "Battle challenge created"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Premium artist access required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Opponent artist not found"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "Database is not configured"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const session = c.get("session"),
      entitlements = await resolveEntitlements({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      });

    if (!entitlements.canCreateLiveBattles) {
      return c.json(
        forbiddenMessage(
          "A premium artist subscription is required to create live battles."
        ),
        HttpStatusCodes.FORBIDDEN
      );
    }

    const body = c.req.valid("json"),
      opponentUsername = body.opponentUsername.trim().replace(/^@/u, "");

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is not configured." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const db = createDb(),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      genreSlug = canonicalGenreSlug(body.genre),
      [genreRow] = await db
        .select({ id: genres.id })
        .from(genres)
        .where(eq(genres.slug, genreSlug))
        .limit(1),
      genreId = genreRow?.id ?? crypto.randomUUID();

    if (!genreRow) {
      await db.insert(genres).values({
        description: null,
        id: genreId,
        name: canonicalGenreName(body.genre),
        slug: genreSlug,
      });
    }

    const [opponentProfile] = await db
      .select({
        primaryGenreSlug: genres.slug,
        userId: userProfiles.userId,
      })
      .from(userProfiles)
      .innerJoin(artistProfiles, eq(artistProfiles.userId, userProfiles.userId))
      .leftJoin(genres, eq(genres.id, artistProfiles.primaryGenreId))
      .where(
        and(
          eq(userProfiles.accountType, "artist"),
          eq(userProfiles.username, opponentUsername)
        )
      )
      .limit(1);

    if (!opponentProfile || opponentProfile.userId === user.id) {
      return c.json(
        { message: "Choose an existing artist other than yourself." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const opponentEntitlements = await resolveEntitlements({
      session: null,
      user: { id: opponentProfile.userId },
    });
    if (!opponentEntitlements.canCreateLiveBattles) {
      return c.json(
        { message: "The selected artist needs Artist Premium to battle." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    if (opponentProfile.primaryGenreSlug !== genreSlug) {
      return c.json(
        {
          message:
            "Battle challenges must match the opponent artist's primary genre.",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const parsedProposedDate = body.proposedDate
        ? new Date(body.proposedDate)
        : null,
      proposedDate =
        parsedProposedDate && !Number.isNaN(parsedProposedDate.getTime())
          ? parsedProposedDate
          : null,
      challengeId = crypto.randomUUID();
    await db.insert(battleChallenges).values({
      challengerOrganizationId: organizationId,
      challengerUserId: user.id,
      format: body.format,
      genreId,
      id: challengeId,
      message: body.message ?? null,
      opponentArtistUserId: opponentProfile?.userId ?? null,
      opponentUsernameSnapshot: opponentUsername,
      proposedDate,
      proposedTimeLabel: body.proposedTimeLabel ?? null,
      status: "pending",
    });

    const [challengerProfile] = await db
        .select({ username: userProfiles.username })
        .from(userProfiles)
        .where(eq(userProfiles.userId, user.id))
        .limit(1),
      challengerUsername = challengerProfile?.username ?? user.name ?? "artist";

    await notify(
      {
        actorUserId: user.id,
        data: {
          actorName: `@${challengerUsername}`,
          challengeId,
          format: body.format,
          genre: canonicalGenreName(body.genre),
        },
        entity: { id: challengeId, type: "battle_challenge" },
        eventId: challengeId,
        recipientUserId: opponentProfile.userId,
        type: "battle.challenge.created",
      },
      { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
    );

    return c.json(
      { message: `Challenge created for ${opponentUsername}` },
      HttpStatusCodes.CREATED
    );
  }
);

const battleKitOwnership = ({
    organizationId,
    userId,
  }: {
    organizationId: string | null;
    userId: string;
  }) =>
    organizationId
      ? or(
          eq(battleKits.ownerUserId, userId),
          and(
            isNull(battleKits.ownerUserId),
            eq(battleKits.organizationId, organizationId)
          )
        )
      : eq(battleKits.ownerUserId, userId),
  buildBattleKitSummary = ({
    kit,
    trackRows,
  }: {
    kit: typeof battleKits.$inferSelect;
    trackRows: {
      coverArtUrl: string | null;
      id: string;
      mainSlot: number | null;
      role: "main" | "tiebreaker";
      title: string;
      trackId: string;
    }[];
  }) => {
    const readiness = evaluateBattleKitReadiness({
      format: kit.format,
      tracks: trackRows,
    });

    return {
      createdAt: kit.createdAt.toISOString(),
      format: kit.format,
      id: kit.id,
      isBattleReady: readiness.isBattleReady,
      mainTrackCount: readiness.mainTrackCount,
      name: kit.title,
      reason: readiness.reason,
      requiredMainTracks: readiness.requiredMainTracks,
      tiebreakerCount: readiness.tiebreakerCount,
      totalRequiredTracks: readiness.totalRequiredTracks,
      totalUniqueTracks: readiness.totalUniqueTracks,
      tracks: trackRows,
      updatedAt: kit.updatedAt.toISOString(),
    };
  },
  loadBattleKitSummaries = async ({
    kits,
  }: {
    kits: (typeof battleKits.$inferSelect)[];
  }) => {
    if (kits.length === 0) {
      return [];
    }

    const db = createDb(),
      kitIds = kits.map((kit) => kit.id),
      trackRows = await db
        .select({
          coverMetadata: trackAssets.metadata,
          coverObjectKey: trackAssets.objectKey,
          id: battleKitTracks.id,
          kitId: battleKitTracks.battleKitId,
          mainSlot: battleKitTracks.mainSlot,
          role: battleKitTracks.role,
          title: tracks.title,
          trackId: battleKitTracks.trackId,
        })
        .from(battleKitTracks)
        .innerJoin(tracks, eq(tracks.id, battleKitTracks.trackId))
        .leftJoin(
          trackAssets,
          and(
            eq(trackAssets.trackId, tracks.id),
            eq(trackAssets.assetKind, "cover_art"),
            eq(trackAssets.isCurrent, true)
          )
        )
        .where(inArray(battleKitTracks.battleKitId, kitIds))
        .orderBy(
          asc(battleKitTracks.battleKitId),
          asc(battleKitTracks.mainSlot),
          desc(trackAssets.updatedAt)
        );

    return Promise.all(
      kits.map((kit) =>
        buildBattleKitSummary({
          kit,
          trackRows: dedupeBattleKitTracks(
            trackRows.filter((track) => track.kitId === kit.id)
          ).map((track) => ({
            coverArtUrl: publicAssetUrlFromParts({
              metadata: track.coverMetadata,
              objectKey: track.coverObjectKey,
            }),
            id: track.id,
            mainSlot: track.mainSlot,
            role: track.role,
            title: track.title,
            trackId: track.trackId,
          })),
        })
      )
    );
  };

app.openapi(
  createRoute({
    method: "get",
    path: "/kits",
    request: { query: battleKitQuerySchema },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(battleKitSchema.array(), "Battle Kits"),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    const query = c.req.valid("query"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      kits = await createDb()
        .select()
        .from(battleKits)
        .where(
          and(
            battleKitOwnership({ organizationId, userId: user.id }),
            query.format ? eq(battleKits.format, query.format) : undefined
          )
        )
        .orderBy(desc(battleKits.updatedAt)),
      summaries = await loadBattleKitSummaries({ kits });

    return c.json(
      query.ready === undefined
        ? summaries
        : summaries.filter((kit) => kit.isBattleReady === query.ready),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/kits/{kitId}",
    request: { params: z.object({ kitId: z.string() }) },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(battleKitSchema, "Battle Kit"),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Battle Kit not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Battle Kit not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      [kit] = await createDb()
        .select()
        .from(battleKits)
        .where(
          and(
            eq(battleKits.id, c.req.valid("param").kitId),
            battleKitOwnership({ organizationId, userId: user.id })
          )
        )
        .limit(1);

    if (!kit) {
      return c.json(
        { message: "Battle Kit not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const [summary] = await loadBattleKitSummaries({ kits: [kit] });
    return c.json(summary, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/kits",
    request: {
      body: jsonContentRequired(
        createBattleKitBodySchema,
        "Battle Kit payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        battleKitSchema,
        "Battle Kit created"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Invalid Battle Kit"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Track ownership required"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "Database unavailable"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is not configured." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const entitlements = await resolveEntitlements({
      session: isAuthenticatedSession(c.get("session"))
        ? c.get("session")
        : null,
      user,
    });
    if (!entitlements.canCreateLiveBattles) {
      return c.json(
        { message: "Artist Premium is required to create Battle Kits." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const body = c.req.valid("json"),
      validationMessage = validateBattleKitTracks({
        format: body.format,
        tracks: body.tracks,
      });
    if (validationMessage) {
      return c.json(
        { message: validationMessage },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      });
    if (!organizationId) {
      return c.json(
        { message: "An artist workspace is required." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const db = createDb(),
      trackIds = body.tracks.map((track) => track.trackId),
      ownedTracks =
        trackIds.length > 0
          ? await db
              .select({ id: tracks.id })
              .from(tracks)
              .where(
                and(
                  inArray(tracks.id, trackIds),
                  or(
                    eq(tracks.ownerUserId, user.id),
                    eq(tracks.organizationId, organizationId)
                  ),
                  eq(tracks.isPublic, true),
                  inArray(tracks.releaseStrategy, [
                    "publish_when_ready",
                    "scheduled",
                  ]),
                  or(
                    isNull(tracks.releaseAt),
                    sql`${tracks.releaseAt} <= now()`
                  )
                )
              )
          : [];
    if (ownedTracks.length !== trackIds.length) {
      return c.json(
        {
          message:
            "Battle Kits can only contain your released, playable tracks.",
        },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const now = new Date(),
      kitId = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(battleKits).values({
        format: body.format,
        id: kitId,
        organizationId,
        ownerUserId: user.id,
        title: body.name,
        updatedAt: now,
      });
      if (body.tracks.length > 0) {
        await tx.insert(battleKitTracks).values(
          body.tracks.map((track, index) => ({
            battleKitId: kitId,
            id: crypto.randomUUID(),
            mainSlot: track.mainSlot,
            role: track.role,
            seedOrder: track.mainSlot ?? index,
            trackId: track.trackId,
          }))
        );
      }
    });

    const [kit] = await db
        .select()
        .from(battleKits)
        .where(eq(battleKits.id, kitId))
        .limit(1),
      [summary] = await loadBattleKitSummaries({ kits: kit ? [kit] : [] });
    return c.json(summary, HttpStatusCodes.CREATED);
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/kits/{kitId}",
    request: {
      body: jsonContentRequired(
        updateBattleKitBodySchema,
        "Battle Kit update payload"
      ),
      params: z.object({ kitId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(battleKitSchema, "Battle Kit updated"),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Invalid Battle Kit"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Track ownership required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Battle Kit not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Battle Kit not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const entitlements = await resolveEntitlements({
      session: isAuthenticatedSession(c.get("session"))
        ? c.get("session")
        : null,
      user,
    });
    if (!entitlements.canCreateLiveBattles) {
      return c.json(
        { message: "Artist Premium is required to update Battle Kits." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const body = c.req.valid("json"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      { kitId } = c.req.valid("param"),
      [existingKit] = await db
        .select()
        .from(battleKits)
        .where(
          and(
            eq(battleKits.id, kitId),
            battleKitOwnership({ organizationId, userId: user.id })
          )
        )
        .limit(1);
    if (!existingKit) {
      return c.json(
        { message: "Battle Kit not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const tracksForKit =
        body.tracks ??
        (await db
          .select({
            mainSlot: battleKitTracks.mainSlot,
            role: battleKitTracks.role,
            trackId: battleKitTracks.trackId,
          })
          .from(battleKitTracks)
          .where(eq(battleKitTracks.battleKitId, kitId))),
      format = body.format ?? existingKit.format,
      validationMessage = validateBattleKitTracks({
        format,
        tracks: tracksForKit,
      });
    if (validationMessage) {
      return c.json(
        { message: validationMessage },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const trackIds = tracksForKit.map((track) => track.trackId),
      ownedTracks =
        trackIds.length > 0
          ? await db
              .select({ id: tracks.id })
              .from(tracks)
              .where(
                and(
                  inArray(tracks.id, trackIds),
                  or(
                    eq(tracks.ownerUserId, user.id),
                    eq(tracks.organizationId, organizationId ?? "")
                  ),
                  eq(tracks.isPublic, true),
                  inArray(tracks.releaseStrategy, [
                    "publish_when_ready",
                    "scheduled",
                  ]),
                  or(
                    isNull(tracks.releaseAt),
                    sql`${tracks.releaseAt} <= now()`
                  )
                )
              )
          : [];
    if (ownedTracks.length !== trackIds.length) {
      return c.json(
        {
          message:
            "Battle Kits can only contain your released, playable tracks.",
        },
        HttpStatusCodes.FORBIDDEN
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(battleKits)
        .set({
          format,
          title: body.name ?? existingKit.title,
          updatedAt: new Date(),
        })
        .where(eq(battleKits.id, kitId));
      if (body.tracks) {
        await tx
          .delete(battleKitTracks)
          .where(eq(battleKitTracks.battleKitId, kitId));
        if (body.tracks.length > 0) {
          await tx.insert(battleKitTracks).values(
            body.tracks.map((track, index) => ({
              battleKitId: kitId,
              id: crypto.randomUUID(),
              mainSlot: track.mainSlot,
              role: track.role,
              seedOrder: track.mainSlot ?? index,
              trackId: track.trackId,
            }))
          );
        }
      }
    });

    const [kit] = await db
        .select()
        .from(battleKits)
        .where(eq(battleKits.id, kitId))
        .limit(1),
      [summary] = await loadBattleKitSummaries({ kits: kit ? [kit] : [] });
    return c.json(summary, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/kits/{kitId}",
    request: { params: z.object({ kitId: z.string() }) },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Battle Kit deleted"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Battle Kit not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Battle Kit not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      { kitId } = c.req.valid("param"),
      [kit] = await db
        .select({ id: battleKits.id })
        .from(battleKits)
        .where(
          and(
            eq(battleKits.id, kitId),
            battleKitOwnership({ organizationId, userId: user.id })
          )
        )
        .limit(1);
    if (!kit) {
      return c.json(
        { message: "Battle Kit not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    await db.delete(battleKits).where(eq(battleKits.id, kitId));
    return c.json({ message: "Battle Kit deleted." }, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/record",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        battleRecordResponseSchema,
        "Artist battle record and participation history"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const emptySummary = {
      battles: 0,
      canceled: 0,
      ducks: 0,
      forfeits: 0,
      losses: 0,
      quits: 0,
      roundsPlayed: 0,
      ties: 0,
      wins: 0,
    };
    if (!isDatabaseConfigured()) {
      return c.json(
        {
          history: [],
          participation: emptySummary,
          ranked: {
            battles: 0,
            canceled: 0,
            ducks: 0,
            forfeits: 0,
            losses: 0,
            quits: 0,
            ties: 0,
            wins: 0,
          },
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      rows = await db
        .select({
          battleId: battleParticipations.battleId,
          battleTitle: battles.title,
          createdAt: battleParticipations.createdAt,
          isRanked: battleParticipations.isRanked,
          result: battleParticipations.result,
          roundsPlayed: battleParticipations.roundsPlayed,
          roundsWon: battleParticipations.roundsWon,
        })
        .from(battleParticipations)
        .innerJoin(battles, eq(battles.id, battleParticipations.battleId))
        .where(eq(battleParticipations.userId, user.id))
        .orderBy(desc(battleParticipations.createdAt)),
      summarize = (items: typeof rows) => ({
        battles: items.length,
        canceled: items.filter((row) => row.result === "canceled").length,
        ducks: items.filter((row) => row.result === "ducked").length,
        forfeits: items.filter((row) => row.result === "forfeited").length,
        losses: items.filter((row) => row.result === "loss").length,
        quits: items.filter((row) => row.result === "quit").length,
        roundsPlayed: items.reduce((total, row) => total + row.roundsPlayed, 0),
        ties: items.filter((row) => row.result === "tie").length,
        wins: items.filter((row) => row.result === "win").length,
      }),
      rankedRows = rows.filter((row) => row.isRanked),
      participation = summarize(rows),
      rankedSummary = summarize(rankedRows);

    return c.json(
      {
        history: rows.map((row) => ({
          battleId: row.battleId,
          battleTitle: row.battleTitle,
          isRanked: row.isRanked,
          recordedAt: row.createdAt.toISOString(),
          result: row.result,
          roundsPlayed: row.roundsPlayed,
          roundsWon: row.roundsWon,
        })),
        participation,
        ranked: rankedSummary,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/stats",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.array(
          z.object({
            downloads: z.number(),
            losses: z.number(),
            purchases: z.number(),
            saves: z.number(),
            ties: z.number(),
            trackId: z.string(),
            trackName: z.string(),
            wins: z.number(),
          })
        ),
        "User's track battle statistics"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    const db = createDb(),
      rows = await db
        .select({
          downloads: battleStats.downloads,
          losses: battleStats.losses,
          purchases: battleStats.purchases,
          saves: battleStats.saves,
          ties: battleStats.ties,
          trackId: battleStats.trackId,
          trackName: tracks.title,
          wins: battleStats.wins,
        })
        .from(battleStats)
        .innerJoin(tracks, eq(tracks.id, battleStats.trackId))
        .where(eq(battleStats.userId, user.id));

    if (rows.length === 0) {
      const userTracks = await db
          .select({
            trackId: tracks.id,
            trackName: tracks.title,
          })
          .from(tracks)
          .where(eq(tracks.ownerUserId, user.id)),
        generatedStats = userTracks.map((t) => ({
          downloads: 0,
          losses: 0,
          purchases: 0,
          saves: 0,
          ties: 0,
          trackId: t.trackId,
          trackName: t.trackName,
          wins: 0,
        }));

      return c.json(generatedStats, HttpStatusCodes.OK);
    }

    return c.json(rows, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/track-history/{trackId}",
    request: {
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({
          history: z.array(
            z.object({
              battleId: z.string(),
              battleTitle: z.string(),
              createdAt: z.string(),
              isTiebreaker: z.boolean(),
              opponentTrackId: z.string().nullable(),
              opponentTrackName: z.string().nullable(),
              roundNumber: z.number(),
              status: z.string(),
              viewerCount: z.number(),
              votesAgainst: z.number(),
              votesFor: z.number(),
              winningTrackId: z.string().nullable(),
            })
          ),
          stats: z.object({
            downloads: z.number(),
            losses: z.number(),
            purchases: z.number(),
            saves: z.number(),
            ties: z.number(),
            wins: z.number(),
          }),
          trackId: z.string(),
          trackName: z.string(),
        }),
        "Track battle rounds history"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Track not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const { trackId } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          history: [],
          stats: {
            downloads: 0,
            losses: 0,
            purchases: 0,
            saves: 0,
            ties: 0,
            wins: 0,
          },
          trackId,
          trackName: "Track",
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      [trackRow] = await db
        .select({ title: tracks.title })
        .from(tracks)
        .where(eq(tracks.id, trackId))
        .limit(1);

    if (!trackRow) {
      return c.json({ message: "Track not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const [statsRow] = await db
        .select({
          downloads: battleStats.downloads,
          losses: battleStats.losses,
          purchases: battleStats.purchases,
          saves: battleStats.saves,
          ties: battleStats.ties,
          wins: battleStats.wins,
        })
        .from(battleStats)
        .where(eq(battleStats.trackId, trackId))
        .limit(1),
      stats = statsRow || {
        downloads: 0,
        losses: 0,
        purchases: 0,
        saves: 0,
        ties: 0,
        wins: 0,
      },
      rounds = await db
        .select({
          battleId: battleRounds.battleId,
          battleTitle: battles.title,
          createdAt: battleRounds.createdAt,
          isTiebreaker: battleRounds.isTiebreaker,
          roundNumber: battleRounds.roundNumber,
          status: battleRounds.status,
          trackOneId: battleRounds.trackOneId,
          trackOneVotes: battleRounds.trackOneVotes,
          trackTwoId: battleRounds.trackTwoId,
          trackTwoVotes: battleRounds.trackTwoVotes,
          viewerCount: battles.viewerCount,
          winningTrackId: battleRounds.winningTrackId,
        })
        .from(battleRounds)
        .innerJoin(battles, eq(battles.id, battleRounds.battleId))
        .where(
          or(
            eq(battleRounds.trackOneId, trackId),
            eq(battleRounds.trackTwoId, trackId)
          )
        )
        .orderBy(desc(battleRounds.createdAt)),
      opponentIds = rounds
        .map((r) => (r.trackOneId === trackId ? r.trackTwoId : r.trackOneId))
        .filter((id): id is string => id !== null);

    let opponentsMap = new Map<string, string>();
    if (opponentIds.length > 0) {
      const opponentRows = await db
        .select({ id: tracks.id, title: tracks.title })
        .from(tracks)
        .where(inArray(tracks.id, opponentIds));
      opponentsMap = new Map(opponentRows.map((r) => [r.id, r.title]));
    }

    const history = rounds.map((r) => {
      const isTrackOne = r.trackOneId === trackId,
        opponentTrackId = isTrackOne ? r.trackTwoId : r.trackOneId,
        opponentTrackName = opponentTrackId
          ? opponentsMap.get(opponentTrackId) || "Unknown Track"
          : "No Opponent",
        votesFor = isTrackOne ? r.trackOneVotes : r.trackTwoVotes,
        votesAgainst = isTrackOne ? r.trackTwoVotes : r.trackOneVotes;

      return {
        battleId: r.battleId,
        battleTitle: r.battleTitle,
        createdAt: r.createdAt.toISOString(),
        isTiebreaker: r.isTiebreaker,
        opponentTrackId,
        opponentTrackName,
        roundNumber: r.roundNumber,
        status: r.status,
        viewerCount: r.viewerCount,
        votesAgainst,
        votesFor,
        winningTrackId: r.winningTrackId,
      };
    });

    return c.json(
      {
        history,
        stats,
        trackId,
        trackName: trackRow.title,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{battleId}",
    request: {
      params: z.object({
        battleId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        battleSummarySchema,
        "Battle detail summary"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Battle not found"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const { battleId } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      const battle = sampleBattles.find((entry) => entry.id === battleId);

      if (!battle) {
        return c.json(
          { message: "Battle not found" },
          HttpStatusCodes.NOT_FOUND
        );
      }

      return c.json(
        {
          ...battle,
          hasPlayedTurn: battle.status === "live",
          replayStatus: "none" as const,
          replayVideoId: null,
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      [row] = await db
        .select({
          challengerArtistUserId: battles.challengerArtistUserId,
          endedAt: battles.endedAt,
          format: battles.format,
          genre: genres.name,
          id: battles.id,
          opponentArtistUserId: battles.opponentArtistUserId,
          outcome: battles.outcome,
          replayVideoId: battles.replayVideoId,
          startsAt: battles.startsAt,
          status: battles.status,
          title: battles.title,
          viewerCount: battles.viewerCount,
          visibility: battles.visibility,
        })
        .from(battles)
        .leftJoin(genres, eq(genres.id, battles.genreId))
        .where(eq(battles.id, battleId))
        .limit(1);

    if (row) {
      const [enrichedRow] = await enrichBattleFeedRows([
          {
            ...row,
            genre: row.genre ? canonicalGenreName(row.genre) : "Uncategorized",
          },
        ]),
        battle = enrichedRow
          ? rankFeaturedBattles([enrichedRow])[0]
          : undefined;

      if (!battle) {
        return c.json(
          { message: "Battle not found" },
          HttpStatusCodes.NOT_FOUND
        );
      }

      return c.json(battle, HttpStatusCodes.OK);
    }

    return c.json({ message: "Battle not found" }, HttpStatusCodes.NOT_FOUND);
  }
);

export default app;
