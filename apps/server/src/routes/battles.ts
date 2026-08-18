/* eslint-disable complexity, unicorn/max-nested-calls, sort-vars, one-var, no-nested-ternary, unicorn/no-nested-ternary, unicorn/no-await-expression-member, unicorn/no-negated-condition, unicorn/prefer-number-properties, unicorn/prefer-ternary, no-shadow */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  battleChallenges,
  battleRounds,
  battleStats,
  battles,
  genres,
  trackAssets,
  trackLyrics,
  tracks,
  userNotifications,
  userProfiles,
} from "@soundkit/db/schema/app";
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { notifyBattleChallengeEmail } from "@/lib/email-events";
import {
  forbiddenMessage,
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { canonicalGenreName, canonicalGenreSlug } from "@/lib/genre-catalog";
import { sampleBattles } from "@/lib/sample-data";
import {
  battleEligibilityBodySchema,
  battleEligibilitySchema,
  battleChallengesResponseSchema,
  battleSummarySchema,
  createChallengeBodySchema,
  messageResponseSchema,
  updateBattleChallengeBodySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>(),
  featuredBattleLimit = 6,
  battleTotalRoundsByFormat = {
    best_of_3: 3,
    best_of_5: 5,
    best_of_7: 7,
  } as const;

interface BattleFeedRow {
  format: "best_of_3" | "best_of_5" | "best_of_7";
  genre: string;
  id: string;
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

const objectUrlFromMetadata = (metadata: unknown) => {
    if (!(metadata && typeof metadata === "object" && "url" in metadata)) {
      return null;
    }

    const { url } = metadata as { url?: unknown };
    return typeof url === "string" ? url : null;
  },
  selectCurrentRound = (rounds: BattleFeedRound[]) =>
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
      roundRows = await db
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
      roundsByBattleId = new Map<string, BattleFeedRound[]>();

    for (const round of roundRows) {
      const rounds = roundsByBattleId.get(round.battleId) ?? [];
      rounds.push(round);
      roundsByBattleId.set(round.battleId, rounds);
    }

    const trackIds = [
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
            objectUrlFromMetadata(asset.metadata),
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
        joinMode:
          battle.status === "live" && currentRound?.status === "active"
            ? ("waiting_room" as const)
            : ("watch_now" as const),
        phaseEndsAt: currentRound?.votingEndsAt?.toISOString() ?? null,
        queueSize: 0,
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
        tracks: roundTracks,
      };
    });
  },
  rankFeaturedBattles = (
    battleRows: Awaited<ReturnType<typeof enrichBattleFeedRows>>
  ) => {
    const featuredIds = new Map(
      battleRows
        .filter((battle) => battle.status === "live")
        .toSorted((first, second) => second.viewerCount - first.viewerCount)
        .slice(0, featuredBattleLimit)
        .map((battle, index) => [battle.id, index + 1])
    );

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
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        battleSummarySchema.array(),
        "Battles feed"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json(sampleBattles, HttpStatusCodes.OK);
    }

    const db = createDb(),
      rows = await db
        .select({
          format: battles.format,
          genre: genres.name,
          id: battles.id,
          startsAt: battles.startsAt,
          status: battles.status,
          title: battles.title,
          viewerCount: battles.viewerCount,
          visibility: battles.visibility,
        })
        .from(battles)
        .leftJoin(genres, eq(genres.id, battles.genreId))
        .orderBy(desc(battles.viewerCount))
        .limit(50),
      enrichedRows = await enrichBattleFeedRows(
        rows.map((row) => ({
          ...row,
          genre: row.genre ? canonicalGenreName(row.genre) : "Uncategorized",
        }))
      );

    return c.json(rankFeaturedBattles(enrichedRows), HttpStatusCodes.OK);
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

    const [ownedTracks, approvedLyricsRows] = await Promise.all([
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
      ]),
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
        hasSynchronizedLyrics = (approvedLyrics?.timedLines?.length ?? 0) > 0;

      return {
        lyricsRevisionId: approvedLyrics?.id ?? null,
        ready: hasSynchronizedLyrics,
        reason: hasSynchronizedLyrics
          ? null
          : "Approved synchronized lyrics are required for battle tracks.",
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
      searchPattern = `%${q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`,
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
            q
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
      rows = await db
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
          format: battleChallenges.format,
          genreId: battleChallenges.genreId,
          opponentArtistUserId: battleChallenges.opponentArtistUserId,
          proposedDate: battleChallenges.proposedDate,
          status: battleChallenges.status,
        })
        .from(battleChallenges)
        .where(eq(battleChallenges.id, challengeId))
        .limit(1),
      canUpdate =
        challenge &&
        (challenge.opponentArtistUserId === user.id ||
          (status === "canceled" && challenge.challengerUserId === user.id));

    if (!canUpdate) {
      return c.json(
        { message: "Battle challenge not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    await db
      .update(battleChallenges)
      .set({ status })
      .where(eq(battleChallenges.id, challengeId));

    if (status === "accepted" || status === "declined") {
      await db.insert(userNotifications).values({
        id: crypto.randomUUID(),
        link: "/dashboard/live",
        message: `Your battle challenge was ${status}.`,
        title: `Battle Challenge ${status === "accepted" ? "Accepted" : "Declined"}`,
        type: `battle_challenge_${status}`,
        userId: challenge.challengerUserId,
      });
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
          title: "SoundKit Artist Battle",
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

    await db.insert(userNotifications).values({
      id: crypto.randomUUID(),
      link: "/dashboard/live/challenge",
      message: `@${challengerUsername} challenged you to a ${body.format.replaceAll("_", " ")} ${canonicalGenreName(body.genre)} battle.`,
      title: "New Battle Challenge",
      type: "battle_challenge",
      userId: opponentProfile.userId,
    });

    await notifyBattleChallengeEmail({
      battleFormat: body.format,
      challengeId,
      challengerName: `@${challengerUsername}`,
      genre: canonicalGenreName(body.genre),
      opponentUserId: opponentProfile.userId,
      queue: c.env.EMAIL_DELIVERY_QUEUE,
    });

    return c.json(
      { message: `Challenge created for ${opponentUsername}` },
      HttpStatusCodes.CREATED
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

      return c.json(battle, HttpStatusCodes.OK);
    }

    const db = createDb(),
      [row] = await db
        .select({
          format: battles.format,
          genre: genres.name,
          id: battles.id,
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
