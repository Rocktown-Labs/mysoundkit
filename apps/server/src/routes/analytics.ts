import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  accountingPeriods,
  artistFollows,
  creatorEarnings,
  creatorStatements,
  genres,
  orderItems,
  orders,
  playbackSessions,
  qualifiedStreams,
  subscriptionRewardAllocations,
  trackAssets,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { tips, transactions } from "@soundkit/db/schema/payments";
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import {
  dateBucketSql,
  getOpenAccountingPeriod,
  playConditionSql,
} from "@/lib/analytics-helpers";
import { publicAssetUrl } from "@/lib/asset-urls";
import {
  isAuthenticatedSession,
  isAuthenticatedUser,
} from "@/lib/entitlements";
import { sampleAnalyticsOverview } from "@/lib/sample-data";
import {
  analyticsAudienceSchema,
  analyticsLiveImpactSchema,
  analyticsLocationsSchema,
  analyticsOverviewSchema,
  analyticsScopeQuerySchema,
  analyticsSourcesSchema,
  analyticsTimeseriesQuerySchema,
  analyticsTimeseriesSchema,
  analyticsTracksResponseSchema,
  artistEarningsOverviewSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>(),
  getArtistTrackIds = async ({
    db,
    organizationId,
    userId,
  }: {
    db: ReturnType<typeof createDb>;
    organizationId: string | null;
    userId: string;
  }) => {
    const userTracks = await db
      .select({
        genre: genres.name,
        id: tracks.id,
        ownerUserId: tracks.ownerUserId,
        title: tracks.title,
      })
      .from(tracks)
      .leftJoin(genres, eq(tracks.genreId, genres.id))
      .where(
        organizationId
          ? or(
              eq(tracks.organizationId, organizationId),
              eq(tracks.ownerUserId, userId)
            )
          : eq(tracks.ownerUserId, userId)
      );

    return {
      trackIds: userTracks.map((t) => t.id),
      tracks: userTracks,
    };
  },
  getRangeStartDate = (range: "7d" | "28d" | "90d" | "12m", now: Date) => {
    const start = new Date(now);
    if (range === "7d") {
      start.setUTCDate(start.getUTCDate() - 7);
    } else if (range === "28d") {
      start.setUTCDate(start.getUTCDate() - 28);
    } else if (range === "90d") {
      start.setUTCDate(start.getUTCDate() - 90);
    } else {
      start.setUTCFullYear(start.getUTCFullYear() - 1);
    }
    return start;
  },
  getArtistBioUsername = async ({
    db,
    userId,
  }: {
    db: ReturnType<typeof createDb>;
    userId: string;
  }) => {
    const [profile] = await db
      .select({ username: userProfiles.username })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    return profile?.username ?? null;
  },
  bioPlaybackCondition = (
    scope: "platform" | "bio",
    username: string | null
  ) => {
    if (scope !== "bio") {
      return sql`true`;
    }
    if (!username) {
      return sql`false`;
    }
    return and(
      eq(playbackSessions.sourceType, "artist_profile"),
      eq(playbackSessions.sourceId, `bio:${username}`)
    );
  },
  bioQualifiedStreamCondition = (
    scope: "platform" | "bio",
    username: string | null
  ) => {
    if (scope !== "bio") {
      return sql`true`;
    }
    if (!username) {
      return sql`false`;
    }
    return and(
      eq(qualifiedStreams.sourceType, "artist_profile"),
      eq(qualifiedStreams.sourceId, `bio:${username}`)
    );
  },
  emptyAnalyticsOverview = {
    estimatedEarningsCents: 0,
    premiumSupporters: 0,
    totalFollowers: 0,
    totalPlays: 0,
    totalQualifiedStreams: 0,
    uniqueListeners: 0,
  };

// 1. TOP KPI OVERVIEW
app.openapi(
  createRoute({
    method: "get",
    path: "/overview",
    request: { query: analyticsScopeQuerySchema },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        analyticsOverviewSchema,
        "Artist analytics overview"
      ),
    },
    tags: ["Analytics"],
  }),
  async (c) => {
    const user = c.get("user"),
      { scope } = c.req.valid("query");
    if (!isDatabaseConfigured() || !isAuthenticatedUser(user)) {
      return c.json(
        scope === "bio" ? emptyAnalyticsOverview : sampleAnalyticsOverview,
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      { trackIds } = await getArtistTrackIds({
        db,
        organizationId,
        userId: user.id,
      }),
      bioUsername =
        scope === "bio"
          ? await getArtistBioUsername({ db, userId: user.id })
          : null,
      playbackSourceCondition = bioPlaybackCondition(scope, bioUsername),
      qualifiedSourceCondition = bioQualifiedStreamCondition(
        scope,
        bioUsername
      );

    if (trackIds.length === 0) {
      return c.json(
        scope === "bio" ? emptyAnalyticsOverview : sampleAnalyticsOverview,
        HttpStatusCodes.OK
      );
    }

    // 1. Verified Plays (30-second rule with short-track fallback)
    const [playsResult] = await db
        .select({
          plays: count(),
          uniqueListeners: countDistinct(playbackSessions.userId),
        })
        .from(playbackSessions)
        .where(
          and(
            inArray(playbackSessions.trackId, trackIds),
            playConditionSql,
            playbackSourceCondition
          )
        ),
      // 2. Qualified Streams (Strictly status = 'qualified' and riskStatus = 'clear')
      [qualifiedResult] = await db
        .select({
          totalQualified: count(),
        })
        .from(qualifiedStreams)
        .where(
          and(
            inArray(qualifiedStreams.trackId, trackIds),
            eq(qualifiedStreams.status, "qualified"),
            eq(qualifiedStreams.riskStatus, "clear"),
            qualifiedSourceCondition
          )
        ),
      // 3. Followers
      [followerResult] = await db
        .select({ count: count() })
        .from(artistFollows)
        .where(eq(artistFollows.artistUserId, user.id)),
      // 4. Funded Supporters (Distinct funded Premium subscribers who contributed to Creator Rewards)
      // Scoped by the same accounting period on both the allocation and the
      // accepted qualified stream (an allocation for a prior period is not a
      // funded supporter for the current period).
      [fundedSupportersResult] = await db
        .select({
          count: countDistinct(subscriptionRewardAllocations.userId),
        })
        .from(subscriptionRewardAllocations)
        .innerJoin(
          qualifiedStreams,
          and(
            eq(qualifiedStreams.userId, subscriptionRewardAllocations.userId),
            inArray(qualifiedStreams.trackId, trackIds),
            eq(qualifiedStreams.status, "qualified"),
            eq(qualifiedStreams.riskStatus, "clear"),
            eq(
              qualifiedStreams.accountingPeriodId,
              subscriptionRewardAllocations.accountingPeriodId
            ),
            qualifiedSourceCondition
          )
        )
        .where(
          and(
            gt(subscriptionRewardAllocations.creatorAllocationCents, 0),
            inArray(subscriptionRewardAllocations.allocationStatus, [
              "allocated",
              "funded",
            ])
          )
        ),
      // 5. Estimated Month-to-Date Earnings (Real creatorEarnings + net direct sales + tips)
      now = new Date(),
      monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
      ),
      openPeriod = await getOpenAccountingPeriod(db, now),
      rewardEarningsScope = openPeriod
        ? eq(creatorEarnings.accountingPeriodId, openPeriod.id)
        : gte(creatorEarnings.createdAt, monthStart),
      [rewardEarningsResult] = await db
        .select({
          totalCents: sql<number>`coalesce(sum(${creatorEarnings.grossAmountCents}), 0)::int`,
        })
        .from(creatorEarnings)
        .where(
          and(
            eq(creatorEarnings.artistUserId, user.id),
            inArray(creatorEarnings.earningType, [
              "premium_stream_reward",
              "ad_supported_reward",
              "live_reward",
              "battle_bonus",
            ]),
            eq(creatorEarnings.status, "estimated"),
            rewardEarningsScope
          )
        ),
      [ordersResult] = await db
        .select({
          totalCents: sql<number>`coalesce(sum(round(${orderItems.priceSnapshot} * 100)), 0)::int`,
        })
        .from(orders)
        .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
        .where(
          and(
            inArray(orderItems.trackId, trackIds),
            eq(orders.status, "paid"),
            gte(orders.createdAt, monthStart)
          )
        ),
      [tipsResult] = await db
        .select({
          totalCents: sql<number>`coalesce(sum(${tips.artistAmountCents}), 0)::int`,
        })
        .from(tips)
        .innerJoin(transactions, eq(tips.transactionId, transactions.id))
        .where(
          and(
            eq(tips.artistUserId, user.id),
            eq(transactions.status, "succeeded"),
            gte(tips.createdAt, monthStart)
          )
        ),
      estimatedEarningsCents =
        Number(rewardEarningsResult?.totalCents ?? 0) +
        Number(ordersResult?.totalCents ?? 0) +
        Number(tipsResult?.totalCents ?? 0);

    return c.json(
      {
        estimatedEarningsCents,
        premiumSupporters: Number(fundedSupportersResult?.count ?? 0),
        totalFollowers: Number(followerResult?.count ?? 0),
        totalPlays: Number(playsResult?.plays ?? 0),
        totalQualifiedStreams: Number(qualifiedResult?.totalQualified ?? 0),
        uniqueListeners: Number(playsResult?.uniqueListeners ?? 0),
      },
      HttpStatusCodes.OK
    );
  }
);

// 2. LISTENING TIMESERIES
app.openapi(
  createRoute({
    method: "get",
    path: "/timeseries",
    request: { query: analyticsTimeseriesQuerySchema },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        analyticsTimeseriesSchema,
        "Listening over time"
      ),
    },
    tags: ["Analytics"],
  }),
  async (c) => {
    const user = c.get("user"),
      { metric, range, scope } = c.req.valid("query");

    if (!isDatabaseConfigured() || !isAuthenticatedUser(user)) {
      return c.json(
        {
          metric,
          points: [],
          range,
          total: 0,
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      { trackIds } = await getArtistTrackIds({
        db,
        organizationId,
        userId: user.id,
      }),
      bioUsername =
        scope === "bio"
          ? await getArtistBioUsername({ db, userId: user.id })
          : null,
      playbackSourceCondition = bioPlaybackCondition(scope, bioUsername),
      qualifiedSourceCondition = bioQualifiedStreamCondition(
        scope,
        bioUsername
      ),
      now = new Date(),
      startDate = getRangeStartDate(range, now);

    if (trackIds.length === 0) {
      return c.json(
        {
          metric,
          points: [],
          range,
          total: 0,
        },
        HttpStatusCodes.OK
      );
    }

    const dateMap = new Map<string, number>(),
      isYear = range === "12m";

    if (isYear) {
      for (let i = 11; i >= 0; i -= 1) {
        const d = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
          ),
          key = d.toISOString().slice(0, 7); // YYYY-MM
        dateMap.set(key, 0);
      }
    } else {
      const numDays = range === "7d" ? 7 : range === "28d" ? 28 : 90;
      for (let i = numDays - 1; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - i);
        const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
        dateMap.set(key, 0);
      }
    }

    if (metric === "qualified_streams") {
      const dateKey = dateBucketSql(range, qualifiedStreams.qualifiedAt),
        rows = await db
          .select({
            count: count(),
            dateKey,
          })
          .from(qualifiedStreams)
          .where(
            and(
              inArray(qualifiedStreams.trackId, trackIds),
              eq(qualifiedStreams.status, "qualified"),
              eq(qualifiedStreams.riskStatus, "clear"),
              gte(qualifiedStreams.qualifiedAt, startDate),
              qualifiedSourceCondition
            )
          )
          .groupBy(dateKey);

      for (const row of rows) {
        if (dateMap.has(row.dateKey)) {
          dateMap.set(row.dateKey, Number(row.count));
        }
      }
    } else if (metric === "unique_listeners") {
      const dateKey = dateBucketSql(range, playbackSessions.startedAt),
        rows = await db
          .select({
            count: countDistinct(playbackSessions.userId),
            dateKey,
          })
          .from(playbackSessions)
          .where(
            and(
              inArray(playbackSessions.trackId, trackIds),
              gte(playbackSessions.startedAt, startDate),
              playConditionSql,
              playbackSourceCondition
            )
          )
          .groupBy(dateKey);

      for (const row of rows) {
        if (dateMap.has(row.dateKey)) {
          dateMap.set(row.dateKey, Number(row.count));
        }
      }
    } else {
      // Metric: "plays" (>= 30s verified plays)
      const dateKey = dateBucketSql(range, playbackSessions.startedAt),
        rows = await db
          .select({
            count: count(),
            dateKey,
          })
          .from(playbackSessions)
          .where(
            and(
              inArray(playbackSessions.trackId, trackIds),
              gte(playbackSessions.startedAt, startDate),
              playConditionSql,
              playbackSourceCondition
            )
          )
          .groupBy(dateKey);

      for (const row of rows) {
        if (dateMap.has(row.dateKey)) {
          dateMap.set(row.dateKey, Number(row.count));
        }
      }
    }

    let total = 0;
    const points = [...dateMap.entries()].map(([date, val]) => {
      total += val;
      let label = date;
      if (isYear) {
        const [y, m] = date.split("-"),
          monthDate = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
        label = monthDate.toLocaleDateString("en-US", { month: "short" });
      } else {
        const [y, m, d] = date.split("-"),
          dayDate = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
        label = dayDate.toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
        });
      }
      return { date, label, value: val };
    });

    return c.json({ metric, points, range, total }, HttpStatusCodes.OK);
  }
);

// 3. TRACK PERFORMANCE BREAKDOWN
app.openapi(
  createRoute({
    method: "get",
    path: "/tracks",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        analyticsTracksResponseSchema,
        "Track performance list"
      ),
    },
    tags: ["Analytics"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isDatabaseConfigured() || !isAuthenticatedUser(user)) {
      return c.json({ tracks: [] }, HttpStatusCodes.OK);
    }

    const db = createDb(),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      { tracks: userTrackList } = await getArtistTrackIds({
        db,
        organizationId,
        userId: user.id,
      });

    if (userTrackList.length === 0) {
      return c.json({ tracks: [] }, HttpStatusCodes.OK);
    }

    const trackPerformanceList = await Promise.all(
      userTrackList.map(async (t) => {
        // 1. Master Audio & Cover Assets (Single lateral lookups - NO DUPLICATE ROWS)
        const [masterAsset] = await db
            .select({ durationMs: trackAssets.durationMs })
            .from(trackAssets)
            .where(
              and(
                eq(trackAssets.trackId, t.id),
                inArray(trackAssets.assetKind, [
                  "master",
                  "untagged_wav",
                  "tagged_mp3",
                ])
              )
            )
            .orderBy(desc(trackAssets.createdAt))
            .limit(1),
          [coverAsset] = await db
            .select({
              assetKind: trackAssets.assetKind,
              metadata: trackAssets.metadata,
              objectKey: trackAssets.objectKey,
            })
            .from(trackAssets)
            .where(
              and(
                eq(trackAssets.trackId, t.id),
                inArray(trackAssets.assetKind, ["cover_art", "artwork"])
              )
            )
            .orderBy(
              sql`case when ${trackAssets.assetKind} = 'cover_art' then 0 else 1 end`,
              desc(trackAssets.createdAt)
            )
            .limit(1),
          durationSeconds = masterAsset?.durationMs
            ? Math.round(masterAsset.durationMs / 1000)
            : 180,
          // 2. Plays & Listeners
          [sessionStats] = await db
            .select({
              completedSessions: sql<number>`count(case when ${playbackSessions.playedSeconds} >= ${durationSeconds} * 0.95 then 1 end)::int`,
              eligiblePremiumSessions: sql<number>`count(case when (${playbackSessions.premiumAtStart} = true OR (${playbackSessions.entitlementSnapshot}->>'isPremium')::boolean = true) AND ${playbackSessions.userId} != ${t.ownerUserId} AND ${playbackSessions.riskStatus} = 'clear' then 1 end)::int`,
              plays: count(),
              totalPlayedSeconds: sql<number>`coalesce(sum(${playbackSessions.playedSeconds}), 0)::int`,
              uniqueListeners: countDistinct(playbackSessions.userId),
            })
            .from(playbackSessions)
            .where(and(eq(playbackSessions.trackId, t.id), playConditionSql)),
          // 3. Qualified Streams
          [qualStats] = await db
            .select({ count: count() })
            .from(qualifiedStreams)
            .where(
              and(
                eq(qualifiedStreams.trackId, t.id),
                eq(qualifiedStreams.status, "qualified"),
                eq(qualifiedStreams.riskStatus, "clear")
              )
            ),
          // 4. Real Creator Earnings for this track
          [earningsStats] = await db
            .select({
              totalCents: sql<number>`coalesce(sum(${creatorEarnings.grossAmountCents}), 0)::int`,
            })
            .from(creatorEarnings)
            .where(
              and(
                eq(creatorEarnings.trackId, t.id),
                eq(creatorEarnings.artistUserId, user.id)
              )
            ),
          playsCount = Number(sessionStats?.plays ?? 0),
          qualCount = Number(qualStats?.count ?? 0),
          eligiblePremiumSessions = Number(
            sessionStats?.eligiblePremiumSessions ?? 0
          ),
          totalPlayed = Number(sessionStats?.totalPlayedSeconds ?? 0),
          avgPercent =
            playsCount > 0 && durationSeconds > 0
              ? Math.min(
                  100,
                  Math.round(
                    (totalPlayed / (playsCount * durationSeconds)) * 100
                  )
                )
              : 0,
          compRate =
            playsCount > 0
              ? Math.min(
                  100,
                  Math.round(
                    (Number(sessionStats?.completedSessions ?? 0) /
                      playsCount) *
                      100
                  )
                )
              : 0,
          // Qualification Rate: Denominator is strictly eligible Premium listening sessions
          qualRate =
            eligiblePremiumSessions > 0
              ? Math.min(
                  100,
                  Math.round((qualCount / eligiblePremiumSessions) * 100)
                )
              : 0,
          estimatedEarningsCents = Number(earningsStats?.totalCents ?? 0),
          coverArtUrl = publicAssetUrl(coverAsset);

        return {
          averageListenPercent: avgPercent,
          completionRate: compRate,
          coverArtUrl,
          durationSeconds: masterAsset?.durationMs
            ? Math.round(masterAsset.durationMs / 1000)
            : null,
          estimatedEarningsCents,
          genre: t.genre ?? "Hip-Hop/Rap",
          plays: playsCount,
          qualificationRate: qualRate,
          qualifiedStreams: qualCount,
          title: t.title,
          trackId: t.id,
          uniqueListeners: Number(sessionStats?.uniqueListeners ?? 0),
        };
      })
    );

    return c.json({ tracks: trackPerformanceList }, HttpStatusCodes.OK);
  }
);

// 4. AUDIENCE & RETENTION
app.openapi(
  createRoute({
    method: "get",
    path: "/audience",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        analyticsAudienceSchema,
        "Audience analytics"
      ),
    },
    tags: ["Analytics"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isDatabaseConfigured() || !isAuthenticatedUser(user)) {
      return c.json(
        {
          catalogDepth: 0,
          listenersWithMultiTrackPlays: 0,
          newListeners: 0,
          premiumSupporters: 0,
          returningListenerRate: 0,
          returningListeners: 0,
          totalUniqueListeners: 0,
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      { trackIds } = await getArtistTrackIds({
        db,
        organizationId,
        userId: user.id,
      });

    if (trackIds.length === 0) {
      return c.json(
        {
          catalogDepth: 0,
          listenersWithMultiTrackPlays: 0,
          newListeners: 0,
          premiumSupporters: 0,
          returningListenerRate: 0,
          returningListeners: 0,
          totalUniqueListeners: 0,
        },
        HttpStatusCodes.OK
      );
    }

    // Measure temporal return behavior: distinct calendar days per listener
    const listenerDayRows = await db
        .select({
          distinctDays: sql<number>`count(distinct to_char(${playbackSessions.startedAt}, 'YYYY-MM-DD'))::int`,
          distinctTracks: countDistinct(playbackSessions.trackId),
          userId: playbackSessions.userId,
        })
        .from(playbackSessions)
        .where(
          and(
            inArray(playbackSessions.trackId, trackIds),
            isNotNull(playbackSessions.userId),
            playConditionSql
          )
        )
        .groupBy(playbackSessions.userId),
      totalListeners = listenerDayRows.length,
      // A listener is "Returning" ONLY if they listened on more than 1 distinct calendar day
      returningListeners = listenerDayRows.filter(
        (l) => Number(l.distinctDays) > 1
      ).length,
      newListeners = Math.max(0, totalListeners - returningListeners),
      multiTrackListeners = listenerDayRows.filter(
        (l) => Number(l.distinctTracks) >= 2
      ).length,
      totalTracksPlayed = listenerDayRows.reduce(
        (acc, l) => acc + Number(l.distinctTracks),
        0
      ),
      catalogDepth =
        totalListeners > 0
          ? Math.round((totalTracksPlayed / totalListeners) * 10) / 10
          : 0,
      // Funded Supporters: funded subscription allocation > 0 contributing to this artist
      // Scoped by the same accounting period on both the allocation and the
      // accepted qualified stream (an allocation for a prior period is not a
      // funded supporter for the current period).
      [fundedSupportersResult] = await db
        .select({
          count: countDistinct(subscriptionRewardAllocations.userId),
        })
        .from(subscriptionRewardAllocations)
        .innerJoin(
          qualifiedStreams,
          and(
            eq(qualifiedStreams.userId, subscriptionRewardAllocations.userId),
            inArray(qualifiedStreams.trackId, trackIds),
            eq(qualifiedStreams.status, "qualified"),
            eq(qualifiedStreams.riskStatus, "clear"),
            eq(
              qualifiedStreams.accountingPeriodId,
              subscriptionRewardAllocations.accountingPeriodId
            )
          )
        )
        .where(
          and(
            gt(subscriptionRewardAllocations.creatorAllocationCents, 0),
            inArray(subscriptionRewardAllocations.allocationStatus, [
              "allocated",
              "funded",
            ])
          )
        );

    return c.json(
      {
        catalogDepth,
        listenersWithMultiTrackPlays: multiTrackListeners,
        newListeners,
        premiumSupporters: Number(fundedSupportersResult?.count ?? 0),
        returningListenerRate:
          totalListeners > 0
            ? Math.round((returningListeners / totalListeners) * 100)
            : 0,
        returningListeners,
        totalUniqueListeners: totalListeners,
      },
      HttpStatusCodes.OK
    );
  }
);

// 5. DISCOVERY SOURCES
app.openapi(
  createRoute({
    method: "get",
    path: "/sources",
    request: { query: analyticsScopeQuerySchema },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        analyticsSourcesSchema,
        "Discovery sources distribution"
      ),
    },
    tags: ["Analytics"],
  }),
  async (c) => {
    const user = c.get("user"),
      { scope } = c.req.valid("query");
    if (!isDatabaseConfigured() || !isAuthenticatedUser(user)) {
      return c.json({ sources: [], total: 0 }, HttpStatusCodes.OK);
    }

    const db = createDb(),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      { trackIds } = await getArtistTrackIds({
        db,
        organizationId,
        userId: user.id,
      }),
      bioUsername =
        scope === "bio"
          ? await getArtistBioUsername({ db, userId: user.id })
          : null,
      playbackSourceCondition = bioPlaybackCondition(scope, bioUsername);

    if (trackIds.length === 0) {
      return c.json({ sources: [], total: 0 }, HttpStatusCodes.OK);
    }

    const rows = await db
        .select({
          count: count(),
          sourceType: playbackSessions.sourceType,
        })
        .from(playbackSessions)
        .where(
          and(
            inArray(playbackSessions.trackId, trackIds),
            playConditionSql,
            playbackSourceCondition
          )
        )
        .groupBy(playbackSessions.sourceType),
      total = rows.reduce((acc, r) => acc + Number(r.count), 0),
      sourceLabels: Record<string, string> = {
        album: "Albums & EPs",
        artist_profile: "Artist Profile",
        battle: "Live Music Battles",
        community: "Community Channels",
        external_deep_link: "External Deep Link",
        global_discovery: "Global Discovery",
        library: "Saved Library",
        listening_party: "Live Listening Parties",
        map: "Music Discovery Map",
        national_discovery: "National Discovery",
        playlist: "User Playlists",
        purchase_library: "Purchased Collection",
        recommendation: "Personalized Recommendations",
        search: "Search & Keywords",
        semantic_search: "AI Natural Language Search",
        share: "Shared Link",
        state_discovery: "State & Regional Discovery",
        vod: "Video On Demand & Live Streams",
      },
      sources = rows.map((r) => {
        const cnt = Number(r.count),
          st = r.sourceType ?? "other";
        return {
          count: cnt,
          label: sourceLabels[st] ?? "Other Discovery",
          percentage: total > 0 ? Math.round((cnt / total) * 100) : 0,
          sourceType: st,
        };
      });

    return c.json({ sources, total }, HttpStatusCodes.OK);
  }
);

// 6. AUDIENCE LOCATIONS (With Privacy Guard: MIN_LOCATION_LISTENERS = 3)
app.openapi(
  createRoute({
    method: "get",
    path: "/locations",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        analyticsLocationsSchema,
        "Audience geography"
      ),
    },
    tags: ["Analytics"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isDatabaseConfigured() || !isAuthenticatedUser(user)) {
      return c.json(
        { hasEnoughData: false, locations: [], totalListeners: 0 },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      { trackIds } = await getArtistTrackIds({
        db,
        organizationId,
        userId: user.id,
      });

    if (trackIds.length === 0) {
      return c.json(
        { hasEnoughData: false, locations: [], totalListeners: 0 },
        HttpStatusCodes.OK
      );
    }

    const rows = await db
        .select({
          city: playbackSessions.city,
          countryCode: playbackSessions.countryCode,
          listeners: countDistinct(playbackSessions.userId),
          regionCode: playbackSessions.regionCode,
        })
        .from(playbackSessions)
        .where(
          and(
            inArray(playbackSessions.trackId, trackIds),
            isNotNull(playbackSessions.countryCode),
            playConditionSql
          )
        )
        .groupBy(
          playbackSessions.countryCode,
          playbackSessions.regionCode,
          playbackSessions.city
        ),
      MIN_LOCATION_LISTENERS = 3,
      totalListeners = rows.reduce((acc, r) => acc + Number(r.listeners), 0);

    if (totalListeners < MIN_LOCATION_LISTENERS) {
      return c.json(
        {
          hasEnoughData: false,
          locations: [],
          totalListeners,
        },
        HttpStatusCodes.OK
      );
    }

    let otherCount = 0;
    const safeLocations = [];

    for (const r of rows) {
      const countNum = Number(r.listeners);
      if (countNum >= MIN_LOCATION_LISTENERS) {
        safeLocations.push({
          city: r.city,
          countryCode: r.countryCode,
          hasEnoughData: true,
          listeners: countNum,
          percentage:
            totalListeners > 0
              ? Math.round((countNum / totalListeners) * 100)
              : 0,
          regionCode: r.regionCode,
        });
      } else {
        otherCount += countNum;
      }
    }

    if (otherCount > 0) {
      safeLocations.push({
        city: "Other Regions",
        countryCode: null,
        hasEnoughData: true,
        listeners: otherCount,
        percentage:
          totalListeners > 0
            ? Math.round((otherCount / totalListeners) * 100)
            : 0,
        regionCode: null,
      });
    }

    return c.json(
      {
        hasEnoughData: safeLocations.length > 0,
        locations: safeLocations,
        totalListeners,
      },
      HttpStatusCodes.OK
    );
  }
);

// 7. LIVE IMPACT ANALYTICS
app.openapi(
  createRoute({
    method: "get",
    path: "/live-impact",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        analyticsLiveImpactSchema,
        "Live experience impact"
      ),
    },
    tags: ["Analytics"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isDatabaseConfigured() || !isAuthenticatedUser(user)) {
      return c.json(
        {
          battlesParticipated: 0,
          hasLiveActivity: false,
          listenersReached: 0,
          listeningPartiesHosted: 0,
          liveQualifiedStreams: 0,
          liveStreamsHosted: 0,
          tracksPlayedInLive: 0,
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      { trackIds } = await getArtistTrackIds({
        db,
        organizationId,
        userId: user.id,
      });

    if (trackIds.length === 0) {
      return c.json(
        {
          battlesParticipated: 0,
          hasLiveActivity: false,
          listenersReached: 0,
          listeningPartiesHosted: 0,
          liveQualifiedStreams: 0,
          liveStreamsHosted: 0,
          tracksPlayedInLive: 0,
        },
        HttpStatusCodes.OK
      );
    }

    const [liveSessionResult] = await db
        .select({
          listenersReached: countDistinct(playbackSessions.userId),
          tracksPlayedInLive: count(),
        })
        .from(playbackSessions)
        .where(
          and(
            inArray(playbackSessions.trackId, trackIds),
            inArray(playbackSessions.sourceType, [
              "listening_party",
              "battle",
              "vod",
            ]),
            playConditionSql
          )
        ),
      [liveQualResult] = await db
        .select({ count: count() })
        .from(qualifiedStreams)
        .where(
          and(
            inArray(qualifiedStreams.trackId, trackIds),
            inArray(qualifiedStreams.sourceType, [
              "listening_party",
              "battle",
              "vod",
            ]),
            eq(qualifiedStreams.status, "qualified"),
            eq(qualifiedStreams.riskStatus, "clear")
          )
        ),
      listenersReached = Number(liveSessionResult?.listenersReached ?? 0),
      tracksPlayedInLive = Number(liveSessionResult?.tracksPlayedInLive ?? 0),
      liveQualifiedStreams = Number(liveQualResult?.count ?? 0);

    return c.json(
      {
        battlesParticipated: 0,
        hasLiveActivity: tracksPlayedInLive > 0,
        listenersReached,
        listeningPartiesHosted: 0,
        liveQualifiedStreams,
        liveStreamsHosted: 0,
        tracksPlayedInLive,
      },
      HttpStatusCodes.OK
    );
  }
);

// 8. CREATOR EARNINGS & STATEMENTS (SOUNDKIT CREATOR EARNINGS)
app.openapi(
  createRoute({
    method: "get",
    path: "/earnings",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        artistEarningsOverviewSchema,
        "Artist earnings overview"
      ),
    },
    tags: ["Analytics"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isDatabaseConfigured() || !isAuthenticatedUser(user)) {
      return c.json(
        {
          availableBalanceCents: 0,
          categories: [
            {
              amountCents: 0,
              category: "creator_rewards",
              label: "Creator Rewards Pool",
            },
            {
              amountCents: 0,
              category: "music_sales",
              label: "Direct Music Sales",
            },
            { amountCents: 0, category: "tips", label: "Fan Tips" },
          ],
          estimatedThisMonthCents: 0,
          nextEstimatedPayoutDate: "End of month",
          paidLifetimeCents: 0,
          payoutMinimumCents: 2500,
          payoutProgressPercent: 0,
          pendingReserveCents: 0,
          statements: [],
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      { trackIds } = await getArtistTrackIds({
        db,
        organizationId,
        userId: user.id,
      }),
      now = new Date(),
      monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
      ),
      // 1. Real creator earnings breakdown by status
      earningStatusRows = await db
        .select({
          earningType: creatorEarnings.earningType,
          grossCents: sql<number>`coalesce(sum(${creatorEarnings.grossAmountCents}), 0)::int`,
          heldCents: sql<number>`coalesce(sum(${creatorEarnings.heldAmountCents}), 0)::int`,
          payableCents: sql<number>`coalesce(sum(${creatorEarnings.payableAmountCents}), 0)::int`,
          status: creatorEarnings.status,
        })
        .from(creatorEarnings)
        .where(eq(creatorEarnings.artistUserId, user.id))
        .groupBy(creatorEarnings.status, creatorEarnings.earningType),
      // 2. Real Direct Music Sales and Tips in the current accounting period
      [monthOrdersResult] = await db
        .select({
          totalCents: sql<number>`coalesce(sum(round(${orderItems.priceSnapshot} * 100)), 0)::int`,
        })
        .from(orders)
        .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
        .where(
          and(
            inArray(
              orderItems.trackId,
              trackIds.length > 0 ? trackIds : ["_none"]
            ),
            eq(orders.status, "paid"),
            gte(orders.createdAt, monthStart)
          )
        ),
      [monthTipsResult] = await db
        .select({
          totalCents: sql<number>`coalesce(sum(${tips.artistAmountCents}), 0)::int`,
        })
        .from(tips)
        .innerJoin(transactions, eq(tips.transactionId, transactions.id))
        .where(
          and(
            eq(tips.artistUserId, user.id),
            eq(transactions.status, "succeeded"),
            gte(tips.createdAt, monthStart)
          )
        ),
      musicSalesCents = Number(monthOrdersResult?.totalCents ?? 0),
      tipsCents = Number(monthTipsResult?.totalCents ?? 0),
      // Creator rewards estimated in the current open accounting period only
      openPeriod = await getOpenAccountingPeriod(db, now),
      [estimatedRewardsResult] = openPeriod
        ? await db
            .select({
              totalCents: sql<number>`coalesce(sum(${creatorEarnings.grossAmountCents}), 0)::int`,
            })
            .from(creatorEarnings)
            .where(
              and(
                eq(creatorEarnings.artistUserId, user.id),
                eq(creatorEarnings.status, "estimated"),
                eq(creatorEarnings.accountingPeriodId, openPeriod.id)
              )
            )
        : [undefined],
      estimatedRewardsCents = Number(estimatedRewardsResult?.totalCents ?? 0),
      estimatedThisMonthCents =
        estimatedRewardsCents + musicSalesCents + tipsCents,
      // Pending / Reserve balance (Held inside 30-day reserve window)
      pendingReserveCents = earningStatusRows
        .filter((r) => r.status === "held" || r.status === "finalized")
        .reduce((sum, r) => sum + Number(r.heldCents || r.grossCents), 0),
      // Available / Payable balance (Cleared from reserve, eligible for payout)
      availableBalanceCents = earningStatusRows
        .filter((r) => r.status === "payable")
        .reduce((sum, r) => sum + Number(r.payableCents || r.grossCents), 0),
      // Paid lifetime balance
      paidLifetimeCents = earningStatusRows
        .filter((r) => r.status === "paid")
        .reduce((sum, r) => sum + Number(r.grossCents), 0),
      payoutMinimumCents = 2500, // $25.00
      payoutProgressPercent = Math.min(
        100,
        Math.round((availableBalanceCents / payoutMinimumCents) * 100)
      ),
      nextMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
      ),
      nextPayoutDate = new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "long",
      }).format(nextMonth),
      categories = [
        {
          amountCents: estimatedRewardsCents,
          category: "creator_rewards",
          label: "Creator Rewards Pool",
        },
        {
          amountCents: musicSalesCents,
          category: "music_sales",
          label: "Direct Music Sales",
        },
        {
          amountCents: tipsCents,
          category: "tips",
          label: "Fan Tips",
        },
      ],
      // 3. Finalized Statements from creatorStatements and accountingPeriods
      statementRows = await db
        .select({
          grossAmountCents: creatorStatements.grossAmountCents,
          heldAmountCents: creatorStatements.heldAmountCents,
          paidAmountCents: creatorStatements.paidAmountCents,
          payableAmountCents: creatorStatements.payableAmountCents,
          periodEndsAt: accountingPeriods.endsAt,
          periodStartsAt: accountingPeriods.startsAt,
          statementId: creatorStatements.id,
          status: creatorStatements.status,
        })
        .from(creatorStatements)
        .leftJoin(
          accountingPeriods,
          eq(creatorStatements.accountingPeriodId, accountingPeriods.id)
        )
        .where(
          and(
            eq(creatorStatements.artistUserId, user.id),
            ne(creatorStatements.status, "draft")
          )
        )
        .orderBy(desc(creatorStatements.createdAt)),
      statements = await Promise.all(
        statementRows.map(async (st) => {
          const pStarts = st.periodStartsAt
              ? new Date(st.periodStartsAt)
              : monthStart,
            pEnds = st.periodEndsAt ? new Date(st.periodEndsAt) : nextMonth,
            monthLabel = new Intl.DateTimeFormat("en-US", {
              month: "long",
              year: "numeric",
            }).format(pStarts),
            [pPlays] = await db
              .select({ count: count() })
              .from(playbackSessions)
              .where(
                and(
                  inArray(
                    playbackSessions.trackId,
                    trackIds.length > 0 ? trackIds : ["_none"]
                  ),
                  gte(playbackSessions.startedAt, pStarts),
                  sql`${playbackSessions.startedAt} < ${pEnds}`,
                  playConditionSql
                )
              ),
            [pQual] = await db
              .select({ count: count() })
              .from(qualifiedStreams)
              .where(
                and(
                  inArray(
                    qualifiedStreams.trackId,
                    trackIds.length > 0 ? trackIds : ["_none"]
                  ),
                  eq(qualifiedStreams.status, "qualified"),
                  eq(qualifiedStreams.riskStatus, "clear"),
                  gte(qualifiedStreams.qualifiedAt, pStarts),
                  sql`${qualifiedStreams.qualifiedAt} < ${pEnds}`
                )
              ),
            [pSales] = await db
              .select({
                totalCents: sql<number>`coalesce(sum(round(${orderItems.priceSnapshot} * 100)), 0)::int`,
              })
              .from(orders)
              .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
              .where(
                and(
                  inArray(
                    orderItems.trackId,
                    trackIds.length > 0 ? trackIds : ["_none"]
                  ),
                  eq(orders.status, "paid"),
                  gte(orders.createdAt, pStarts),
                  sql`${orders.createdAt} < ${pEnds}`
                )
              ),
            [pTips] = await db
              .select({
                totalCents: sql<number>`coalesce(sum(${tips.artistAmountCents}), 0)::int`,
              })
              .from(tips)
              .innerJoin(transactions, eq(tips.transactionId, transactions.id))
              .where(
                and(
                  eq(tips.artistUserId, user.id),
                  eq(transactions.status, "succeeded"),
                  gte(tips.createdAt, pStarts),
                  sql`${tips.createdAt} < ${pEnds}`
                )
              );

          return {
            creatorRewardsCents: Number(st.grossAmountCents ?? 0),
            monthLabel,
            musicSalesCents: Number(pSales?.totalCents ?? 0),
            periodEndsAt: pEnds.toISOString(),
            periodStartsAt: pStarts.toISOString(),
            plays: Number(pPlays?.count ?? 0),
            qualifiedStreams: Number(pQual?.count ?? 0),
            tipsCents: Number(pTips?.totalCents ?? 0),
            totalEarningsCents: Number(
              st.payableAmountCents ?? st.grossAmountCents ?? 0
            ),
          };
        })
      );

    return c.json(
      {
        availableBalanceCents,
        categories,
        estimatedThisMonthCents,
        nextEstimatedPayoutDate: nextPayoutDate,
        paidLifetimeCents,
        payoutMinimumCents,
        payoutProgressPercent,
        pendingReserveCents,
        statements,
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
