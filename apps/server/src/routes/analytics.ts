import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  genres,
  orderItems,
  orders,
  playbackSessions,
  qualifiedStreams,
  rewardUnits,
  trackAssets,
  tracks,
} from "@soundkit/db/schema/app";
import { tips, transactions } from "@soundkit/db/schema/payments";
import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  inArray,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

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
  analyticsSourcesSchema,
  analyticsTimeseriesQuerySchema,
  analyticsTimeseriesSchema,
  analyticsTracksResponseSchema,
  artistEarningsOverviewSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>(),

// Helper to get artist track IDs and workspace context
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
      durationSeconds: sql<
        number | null
      >`round(${trackAssets.durationMs} / 1000.0)::int`,
      genre: genres.name,
      id: tracks.id,
      objectKey: trackAssets.objectKey,
      title: tracks.title,
    })
    .from(tracks)
    .leftJoin(genres, eq(tracks.genreId, genres.id))
    .leftJoin(
      trackAssets,
      and(
        eq(trackAssets.trackId, tracks.id),
        inArray(trackAssets.assetKind, ["master", "untagged_wav", "tagged_mp3"])
      )
    )
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
};

// 1. TOP KPI OVERVIEW
app.openapi(
  createRoute({
    method: "get",
    path: "/overview",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        analyticsOverviewSchema,
        "Artist analytics overview"
      ),
    },
    tags: ["Analytics"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isDatabaseConfigured() || !isAuthenticatedUser(user)) {
      return c.json(sampleAnalyticsOverview, HttpStatusCodes.OK);
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
      return c.json(sampleAnalyticsOverview, HttpStatusCodes.OK);
    }

    // 1. Plays: sessions with >= 30s of played duration
    const [playsResult] = await db
      .select({
        plays: count(),
        uniqueListeners: countDistinct(playbackSessions.userId),
      })
      .from(playbackSessions)
      .where(
        and(
          inArray(playbackSessions.trackId, trackIds),
          gte(playbackSessions.playedSeconds, 30)
        )
      ),

    // 2. Qualified Streams: authoritative qualifiedStreams table
     [qualifiedResult] = await db
      .select({
        premiumSupporters: countDistinct(qualifiedStreams.userId),
        totalQualified: count(),
      })
      .from(qualifiedStreams)
      .where(inArray(qualifiedStreams.trackId, trackIds)),

    // 3. Followers
     [followerResult] = await db
      .select({ count: count() })
      .from(artistFollows)
      .where(eq(artistFollows.artistUserId, user.id)),

    // 4. Estimated Earnings: Month-to-date reward units + music orders + tips
     [rewardUnitsResult] = await db
      .select({ count: count() })
      .from(rewardUnits)
      .where(
        and(
          inArray(rewardUnits.trackId, trackIds),
          eq(rewardUnits.status, "pending")
        )
      ),

     [ordersResult] = await db
      .select({
        totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(
        and(inArray(orderItems.trackId, trackIds), eq(orders.status, "paid"))
      ),

     [tipsResult] = await db
      .select({
        totalCents: sql<number>`coalesce(sum(${tips.amountCents}), 0)::int`,
      })
      .from(tips)
      .innerJoin(transactions, eq(tips.transactionId, transactions.id))
      .where(
        and(
          eq(tips.artistUserId, user.id),
          eq(transactions.status, "succeeded")
        )
      ),

     estimatedRewardCents = Math.round(
      Number(rewardUnitsResult?.count ?? 0) * 1.5
    ),
     estimatedEarningsCents =
      estimatedRewardCents +
      Number(ordersResult?.totalCents ?? 0) +
      Number(tipsResult?.totalCents ?? 0);

    return c.json(
      {
        estimatedEarningsCents,
        premiumSupporters: Number(qualifiedResult?.premiumSupporters ?? 0),
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
     { metric, range } = c.req.valid("query");

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

    // Build timeline buckets with zero-filled dates
    const dateMap = new Map<string, number>(),
     isYear = range === "12m";

    if (isYear) {
      for (let i = 11; i >= 0; i -= 1) {
        const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
         key = d.toISOString().slice(0, 7); // YYYY-MM
        dateMap.set(key, 0);
      }
    } else {
      const numDays = range === "7d" ? 7 : (range === "28d" ? 28 : 90);
      for (let i = numDays - 1; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - i);
        const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
        dateMap.set(key, 0);
      }
    }

    if (metric === "qualified_streams") {
      const rows = await db
        .select({
          count: count(),
          dateKey: isYear
            ? sql<string>`to_char(${qualifiedStreams.qualifiedAt}, 'YYYY-MM')`
            : sql<string>`to_char(${qualifiedStreams.qualifiedAt}, 'YYYY-MM-DD')`,
        })
        .from(qualifiedStreams)
        .where(
          and(
            inArray(qualifiedStreams.trackId, trackIds),
            gte(qualifiedStreams.qualifiedAt, startDate)
          )
        )
        .groupBy(sql`1`);

      for (const row of rows) {
        if (dateMap.has(row.dateKey)) {
          dateMap.set(row.dateKey, Number(row.count));
        }
      }
    } else if (metric === "unique_listeners") {
      const rows = await db
        .select({
          count: countDistinct(playbackSessions.userId),
          dateKey: isYear
            ? sql<string>`to_char(${playbackSessions.startedAt}, 'YYYY-MM')`
            : sql<string>`to_char(${playbackSessions.startedAt}, 'YYYY-MM-DD')`,
        })
        .from(playbackSessions)
        .where(
          and(
            inArray(playbackSessions.trackId, trackIds),
            gte(playbackSessions.startedAt, startDate),
            gte(playbackSessions.playedSeconds, 30)
          )
        )
        .groupBy(sql`1`);

      for (const row of rows) {
        if (dateMap.has(row.dateKey)) {
          dateMap.set(row.dateKey, Number(row.count));
        }
      }
    } else {
      // Metric: "plays" (>= 30s playback)
      const rows = await db
        .select({
          count: count(),
          dateKey: isYear
            ? sql<string>`to_char(${playbackSessions.startedAt}, 'YYYY-MM')`
            : sql<string>`to_char(${playbackSessions.startedAt}, 'YYYY-MM-DD')`,
        })
        .from(playbackSessions)
        .where(
          and(
            inArray(playbackSessions.trackId, trackIds),
            gte(playbackSessions.startedAt, startDate),
            gte(playbackSessions.playedSeconds, 30)
          )
        )
        .groupBy(sql`1`);

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
         monthDate = new Date(Number(y), Number(m) - 1, 1);
        label = monthDate.toLocaleDateString("en-US", { month: "short" });
      } else {
        const [y, m, d] = date.split("-"),
         dayDate = new Date(Number(y), Number(m) - 1, Number(d));
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
        // 1. Plays & Listeners
        const [sessionStats] = await db
          .select({
            completedSessions: sql<number>`count(case when ${playbackSessions.playedSeconds} >= coalesce(${t.durationSeconds}, 180) * 0.95 then 1 end)::int`,
            plays: count(),
            totalPlayedSeconds: sql<number>`coalesce(sum(${playbackSessions.playedSeconds}), 0)::int`,
            uniqueListeners: countDistinct(playbackSessions.userId),
          })
          .from(playbackSessions)
          .where(
            and(
              eq(playbackSessions.trackId, t.id),
              gte(playbackSessions.playedSeconds, 30)
            )
          ),

        // 2. Qualified Streams
         [qualStats] = await db
          .select({ count: count() })
          .from(qualifiedStreams)
          .where(eq(qualifiedStreams.trackId, t.id)),

        // 3. Reward Units
         [rewardStats] = await db
          .select({ count: count() })
          .from(rewardUnits)
          .where(eq(rewardUnits.trackId, t.id)),

         playsCount = Number(sessionStats?.plays ?? 0),
          qualCount = Number(qualStats?.count ?? 0),
          trackDuration = t.durationSeconds ?? 180,
          totalPlayed = Number(sessionStats?.totalPlayedSeconds ?? 0),
          avgPercent =
            playsCount > 0 && trackDuration > 0
              ? Math.min(
                  100,
                  Math.round((totalPlayed / (playsCount * trackDuration)) * 100)
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
          qualRate =
            playsCount > 0
              ? Math.min(100, Math.round((qualCount / playsCount) * 100))
              : 0,
          estimatedEarningsCents = Math.round(
            Number(rewardStats?.count ?? 0) * 1.5
          );

        return {
          averageListenPercent: avgPercent,
          completionRate: compRate,
          coverArtUrl: t.objectKey ?? null,
          durationSeconds: t.durationSeconds ?? null,
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

    const [totalListenerResult] = await db
      .select({
        count: countDistinct(playbackSessions.userId),
      })
      .from(playbackSessions)
      .where(
        and(
          inArray(playbackSessions.trackId, trackIds),
          gte(playbackSessions.playedSeconds, 30)
        )
      ),

     [premiumResult] = await db
      .select({ count: countDistinct(qualifiedStreams.userId) })
      .from(qualifiedStreams)
      .where(inArray(qualifiedStreams.trackId, trackIds)),

    // Measure multi-track listeners
     listenerTrackCounts = await db
      .select({
        distinctTracks: countDistinct(playbackSessions.trackId),
        userId: playbackSessions.userId,
      })
      .from(playbackSessions)
      .where(
        and(
          inArray(playbackSessions.trackId, trackIds),
          isNotNull(playbackSessions.userId),
          gte(playbackSessions.playedSeconds, 30)
        )
      )
      .groupBy(playbackSessions.userId),

     totalListeners = Number(totalListenerResult?.count ?? 0),
     multiTrackListeners = listenerTrackCounts.filter(
      (l) => Number(l.distinctTracks) >= 2
    ).length,

     totalTracksPlayed = listenerTrackCounts.reduce(
      (acc, l) => acc + Number(l.distinctTracks),
      0
    ),
     catalogDepth =
      listenerTrackCounts.length > 0
        ? Math.round((totalTracksPlayed / listenerTrackCounts.length) * 10) / 10
        : 0;

    return c.json(
      {
        catalogDepth,
        listenersWithMultiTrackPlays: multiTrackListeners,
        newListeners: Math.max(0, totalListeners - multiTrackListeners),
        premiumSupporters: Number(premiumResult?.count ?? 0),
        returningListenerRate:
          totalListeners > 0
            ? Math.round((multiTrackListeners / totalListeners) * 100)
            : 0,
        returningListeners: multiTrackListeners,
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
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        analyticsSourcesSchema,
        "Discovery sources distribution"
      ),
    },
    tags: ["Analytics"],
  }),
  async (c) => {
    const user = c.get("user");
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
      });

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
          gte(playbackSessions.playedSeconds, 30)
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
          gte(playbackSessions.playedSeconds, 30),
          isNotNull(playbackSessions.countryCode)
        )
      )
      .groupBy(
        playbackSessions.countryCode,
        playbackSessions.regionCode,
        playbackSessions.city
      ),

     MIN_LOCATION_LISTENERS = 3,
     totalListeners = rows.reduce(
      (acc, r) => acc + Number(r.listeners),
      0
    );

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
          ])
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
          ])
        )
      ),

     listenersReached = Number(liveSessionResult?.listenersReached ?? 0),
     tracksPlayedInLive = Number(
      liveSessionResult?.tracksPlayedInLive ?? 0
    ),
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

    // 1. Month-to-date estimated rewards
     [monthRewardResult] = await db
      .select({ count: count() })
      .from(rewardUnits)
      .where(
        and(
          inArray(
            rewardUnits.trackId,
            trackIds.length > 0 ? trackIds : ["_none"]
          ),
          eq(rewardUnits.status, "pending")
        )
      ),

     [monthOrdersResult] = await db
      .select({
        totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(
        and(
          inArray(
            orderItems.trackId,
            trackIds.length > 0 ? trackIds : ["_none"]
          ),
          eq(orders.status, "paid")
        )
      ),

     [monthTipsResult] = await db
      .select({
        totalCents: sql<number>`coalesce(sum(${tips.amountCents}), 0)::int`,
      })
      .from(tips)
      .innerJoin(transactions, eq(tips.transactionId, transactions.id))
      .where(
        and(
          eq(tips.artistUserId, user.id),
          eq(transactions.status, "succeeded")
        )
      ),

     creatorRewardsCents = Math.round(
      Number(monthRewardResult?.count ?? 0) * 1.5
    ),
     musicSalesCents = Number(monthOrdersResult?.totalCents ?? 0),
     tipsCents = Number(monthTipsResult?.totalCents ?? 0),
     estimatedThisMonthCents =
      creatorRewardsCents + musicSalesCents + tipsCents,

    // Available & Reserve Balances
     availableBalanceCents = 0, // Cleared from 30-day reserve
     pendingReserveCents = estimatedThisMonthCents, // Current 30-day window
     payoutMinimumCents = 2500, // $25.00
     payoutProgressPercent = Math.min(
      100,
      Math.round((availableBalanceCents / payoutMinimumCents) * 100)
    ),

     now = new Date(),
     nextMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    ),
     nextPayoutDate = new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
    }).format(nextMonth),

     categories = [
      {
        amountCents: creatorRewardsCents,
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

    // Current month statement
     currentMonthLabel = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(now),

     [playsResult] = await db
      .select({ count: count() })
      .from(playbackSessions)
      .where(
        and(
          inArray(
            playbackSessions.trackId,
            trackIds.length > 0 ? trackIds : ["_none"]
          ),
          gte(playbackSessions.playedSeconds, 30)
        )
      ),

     [qualResult] = await db
      .select({ count: count() })
      .from(qualifiedStreams)
      .where(
        inArray(
          qualifiedStreams.trackId,
          trackIds.length > 0 ? trackIds : ["_none"]
        )
      ),

     statements = [
      {
        creatorRewardsCents,
        monthLabel: currentMonthLabel,
        musicSalesCents,
        periodEndsAt: nextMonth.toISOString(),
        periodStartsAt: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
        ).toISOString(),
        plays: Number(playsResult?.count ?? 0),
        qualifiedStreams: Number(qualResult?.count ?? 0),
        tipsCents,
        totalEarningsCents: estimatedThisMonthCents,
      },
    ];

    return c.json(
      {
        availableBalanceCents,
        categories,
        estimatedThisMonthCents,
        nextEstimatedPayoutDate: nextPayoutDate,
        paidLifetimeCents: 0,
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
