import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  battleChallenges,
  battleRounds,
  battleStats,
  battles,
  genres,
  trackLyrics,
  tracks,
  userNotifications,
  userProfiles,
} from "@soundkit/db/schema/app";
import { and, desc, eq, inArray, or } from "drizzle-orm";
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
  battleSummarySchema,
  createChallengeBodySchema,
  messageResponseSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>();
const featuredBattleLimit = 6;

const rankFeaturedBattles = (
  battleRows: {
    format: "best_of_3" | "best_of_5" | "best_of_7";
    genre: string;
    id: string;
    status: "scheduled" | "live" | "completed" | "archived";
    title: string;
    viewerCount: number;
    visibility: "public" | "premium_only";
  }[]
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
      return c.json(rankFeaturedBattles(sampleBattles), HttpStatusCodes.OK);
    }

    const db = createDb();
    const rows = await db
      .select({
        format: battles.format,
        genre: genres.name,
        id: battles.id,
        status: battles.status,
        title: battles.title,
        viewerCount: battles.viewerCount,
        visibility: battles.visibility,
      })
      .from(battles)
      .leftJoin(genres, eq(genres.id, battles.genreId))
      .orderBy(desc(battles.viewerCount));

    return c.json(
      rankFeaturedBattles(
        rows.map((row) => ({
          ...row,
          genre: row.genre ? canonicalGenreName(row.genre) : "Uncategorized",
        }))
      ),
      HttpStatusCodes.OK
    );
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

    const db = createDb();
    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
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
    ]);

    const ownedTrackIds = new Set(ownedTracks.map((track) => track.id));
    const approvedLyricsByTrackId = new Map<
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

      const approvedLyrics = approvedLyricsByTrackId.get(trackId);
      const hasSynchronizedLyrics =
        (approvedLyrics?.timedLines?.length ?? 0) > 0;

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

    const session = c.get("session");
    const entitlements = await resolveEntitlements({
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

    const body = c.req.valid("json");
    const opponentUsername = body.opponentUsername.trim().replace(/^@/u, "");

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: `Challenge created for ${opponentUsername}` },
        HttpStatusCodes.CREATED
      );
    }

    const db = createDb();
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });

    const genreSlug = canonicalGenreSlug(body.genre);
    const [genreRow] = await db
      .select({ id: genres.id })
      .from(genres)
      .where(eq(genres.slug, genreSlug))
      .limit(1);
    const genreId = genreRow?.id ?? crypto.randomUUID();

    if (!genreRow) {
      await db.insert(genres).values({
        description: null,
        id: genreId,
        name: canonicalGenreName(body.genre),
        slug: genreSlug,
      });
    }

    const [opponentProfile] = await db
      .select({ userId: userProfiles.userId })
      .from(userProfiles)
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

    const parsedProposedDate = body.proposedDate
      ? new Date(body.proposedDate)
      : null;
    const proposedDate =
      parsedProposedDate && !Number.isNaN(parsedProposedDate.getTime())
        ? parsedProposedDate
        : null;

    const challengeId = crypto.randomUUID();
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
      .limit(1);
    const challengerUsername =
      challengerProfile?.username ?? user.name ?? "artist";

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
      return c.json(
        [
          {
            downloads: 120,
            losses: 4,
            purchases: 8,
            saves: 45,
            trackId: "track-1",
            trackName: "Midnight Vibes",
            wins: 12,
          },
          {
            downloads: 90,
            losses: 6,
            purchases: 5,
            saves: 30,
            trackId: "track-2",
            trackName: "Neon Dreams",
            wins: 8,
          },
        ],
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const rows = await db
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
        .where(eq(tracks.ownerUserId, user.id));

      const generatedStats = userTracks.map((t) => ({
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
          history: [
            {
              battleId: "battle-1",
              battleTitle: "Summer Beat Showdown",
              createdAt: new Date(Date.now() - 86_400_000 * 2).toISOString(),
              isTiebreaker: false,
              opponentTrackId: "track-3",
              opponentTrackName: "Golden Hours",
              roundNumber: 1,
              status: "completed",
              viewerCount: 240,
              votesAgainst: 43,
              votesFor: 87,
              winningTrackId: trackId,
            },
            {
              battleId: "battle-1",
              battleTitle: "Summer Beat Showdown",
              createdAt: new Date(
                Date.now() - 86_400_000 * 2 + 3_600_000
              ).toISOString(),
              isTiebreaker: false,
              opponentTrackId: "track-3",
              opponentTrackName: "Golden Hours",
              roundNumber: 2,
              status: "completed",
              viewerCount: 310,
              votesAgainst: 51,
              votesFor: 92,
              winningTrackId: trackId,
            },
            {
              battleId: "battle-2",
              battleTitle: "Late Night Melodies",
              createdAt: new Date(Date.now() - 86_400_000 * 5).toISOString(),
              isTiebreaker: false,
              opponentTrackId: "track-4",
              opponentTrackName: "City Lights",
              roundNumber: 1,
              status: "completed",
              viewerCount: 180,
              votesAgainst: 76,
              votesFor: 54,
              winningTrackId: "track-4",
            },
          ],
          stats: {
            downloads: 120,
            losses: 4,
            purchases: 8,
            saves: 45,
            wins: 12,
          },
          trackId,
          trackName: trackId === "track-1" ? "Midnight Vibes" : "Neon Dreams",
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb();

    const [trackRow] = await db
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
      .limit(1);

    const stats = statsRow || {
      downloads: 0,
      losses: 0,
      purchases: 0,
      saves: 0,
      wins: 0,
    };

    const rounds = await db
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
      .orderBy(desc(battleRounds.createdAt));

    const opponentIds = rounds
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
      const isTrackOne = r.trackOneId === trackId;
      const opponentTrackId = isTrackOne ? r.trackTwoId : r.trackOneId;
      const opponentTrackName = opponentTrackId
        ? opponentsMap.get(opponentTrackId) || "Unknown Track"
        : "No Opponent";
      const votesFor = isTrackOne ? r.trackOneVotes : r.trackTwoVotes;
      const votesAgainst = isTrackOne ? r.trackTwoVotes : r.trackOneVotes;

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
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const { battleId } = c.req.valid("param");
    if (isDatabaseConfigured()) {
      const db = createDb();
      const [row] = await db
        .select({
          format: battles.format,
          genre: genres.name,
          id: battles.id,
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
        return c.json(
          rankFeaturedBattles([
            {
              ...row,
              genre: row.genre
                ? canonicalGenreName(row.genre)
                : "Uncategorized",
            },
          ])[0],
          HttpStatusCodes.OK
        );
      }
    }

    const rankedFallbackBattles = rankFeaturedBattles(sampleBattles);
    const battle =
      rankedFallbackBattles.find((entry) => entry.id === battleId) ??
      rankedFallbackBattles[0];
    return c.json(battle, HttpStatusCodes.OK);
  }
);

export default app;
