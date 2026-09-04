import type { createDb } from "@soundkit/db";
import {
  accountingPeriods,
  creatorEarnings,
  playbackSessions,
  qualifiedStreams,
  subscriptionRewardAllocations,
  trackAssets,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user } from "@soundkit/db/schema/auth";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AppEnv } from "@/lib/types";
import analyticsRoutes from "@/routes/analytics";
import libraryRoutes from "@/routes/library";

const DATABASE_URL =
  process.env.SOUNDKIT_TEST_DATABASE_URL ??
  "postgres://soundkit_test:soundkit_test@127.0.0.1:5432/soundkit_test?sslmode=disable";

process.env.DATABASE_URL = DATABASE_URL;
process.env.MEDIA_PUBLIC_URL = "https://media.example.test";

const probeDatabase = async (url: string) => {
    if (process.env.SOUNDKIT_DISABLE_DB_TESTS === "true") {
      return false;
    }
    const match = /^postgres:\/\/(?:[^:]+:[^@]+@)?([^:/]+):(\d+)/u.exec(url);
    if (!match) {
      return false;
    }
    const [, host, port] = match;
    try {
      const { default: net } = await import("node:net");
      return await new Promise<boolean>((resolve) => {
        const socket = net.connect(Number(port), host, () => {
          socket.destroy();
          resolve(true);
        });
        socket.setTimeout(3000, () => {
          socket.destroy();
          resolve(false);
        });
        socket.on("error", () => {
          socket.destroy();
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  },
  dbConnected = await probeDatabase(DATABASE_URL),
  ARTIST_ID = "db-test-artist",
  LISTENER_A = "db-test-listener-a",
  LISTENER_B = "db-test-listener-b",
  PERIOD_CURRENT = "db-test-period-current",
  PERIOD_PREV = "db-test-period-prev",
  TRACK_LONG = "db-test-track-long",
  TRACK_NO_ASSETS = "db-test-track-no-assets",
  TRACK_SHORT = "db-test-track-short";

let db: ReturnType<typeof createDb>;

const makeApp = (userId: string, sessionId = "db-test-session") => {
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("user", {
        banned: false,
        email: "artist@test.dev",
        id: userId,
        name: "Test Artist",
        role: "artist",
      });
      c.set("session", {
        activeOrganizationId: null,
        id: sessionId,
        userId,
      });
      c.set("requestId", sessionId);
      await next();
    });
    app.route("/v1/analytics", analyticsRoutes);
    app.route("/v1/library", libraryRoutes);
    return app;
  },
  seedBaseline = async () => {
    const now = new Date(),
      monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
      ),
      prevStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
      ),
      seedUserId = "db-test-seed-user";

    await db.insert(user).values([
      {
        email: "db-test-artist@test.dev",
        id: ARTIST_ID,
        name: "Test Artist",
        role: "artist",
      },
      {
        email: "db-test-listener-a@test.dev",
        id: LISTENER_A,
        name: "Listener A",
      },
      {
        email: "db-test-listener-b@test.dev",
        id: LISTENER_B,
        name: "Listener B",
      },
      {
        email: "db-test-seed-user@test.dev",
        id: seedUserId,
        name: "Seed User",
      },
    ]);

    await db.insert(userProfiles).values({
      accountType: "artist",
      userId: ARTIST_ID,
      username: "testartist",
    });

    await db.insert(tracks).values([
      {
        id: TRACK_LONG,
        ownerUserId: ARTIST_ID,
        slug: "db-test-track-long",
        title: "Long Track",
      },
      {
        id: TRACK_SHORT,
        ownerUserId: ARTIST_ID,
        slug: "db-test-track-short",
        title: "Short Track",
      },
      {
        id: TRACK_NO_ASSETS,
        ownerUserId: ARTIST_ID,
        slug: "db-test-track-no-assets",
        title: "No Assets",
      },
    ]);

    await db.insert(trackAssets).values([
      {
        assetKind: "master",
        durationMs: 180_000,
        id: "db-test-master-long",
        storageProvider: "r2",
        trackId: TRACK_LONG,
      },
      {
        assetKind: "cover_art",
        id: "db-test-cover-long",
        metadata: { url: "https://cdn.example.test/long-cover.png" },
        objectKey: "long-cover.png",
        storageProvider: "r2",
        trackId: TRACK_LONG,
      },
      {
        assetKind: "master",
        durationMs: 20_000,
        id: "db-test-master-short",
        storageProvider: "r2",
        trackId: TRACK_SHORT,
      },
      {
        assetKind: "artwork",
        id: "db-test-artwork-long",
        metadata: { url: "https://cdn.example.test/long-artwork.png" },
        objectKey: "long-artwork.png",
        storageProvider: "r2",
        trackId: TRACK_LONG,
      },
    ]);

    const sessionValues = (
      id: string,
      trackId: string,
      userIdValue: string,
      playedSeconds: number,
      startedAt: Date,
      overrides: Partial<typeof playbackSessions.$inferInsert> = {}
    ) => ({
      id,
      playedSeconds,
      sourceType: "playlist" as const,
      startedAt,
      status: "ended" as const,
      trackId,
      userId: userIdValue,
      ...overrides,
    });

    await db.insert(playbackSessions).values([
      sessionValues(
        "db-test-sess-long-a29",
        TRACK_LONG,
        LISTENER_A,
        29,
        monthStart
      ),
      sessionValues(
        "db-test-sess-long-a30",
        TRACK_LONG,
        LISTENER_A,
        30,
        monthStart,
        { sourceId: "bio:testartist", sourceType: "artist_profile" }
      ),
      sessionValues(
        "db-test-sess-long-b30",
        TRACK_LONG,
        LISTENER_B,
        30,
        monthStart,
        { sourceId: "bio:testartist", sourceType: "artist_profile" }
      ),
      sessionValues(
        "db-test-sess-long-rejected",
        TRACK_LONG,
        LISTENER_B,
        40,
        monthStart,
        {
          riskStatus: "rejected",
        }
      ),
      sessionValues(
        "db-test-sess-short-a18",
        TRACK_SHORT,
        LISTENER_A,
        18,
        monthStart
      ),
      sessionValues(
        "db-test-sess-short-a19",
        TRACK_SHORT,
        LISTENER_A,
        19,
        monthStart
      ),
    ]);

    await db.insert(accountingPeriods).values([
      {
        currency: "USD",
        endsAt: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
        ),
        id: PERIOD_CURRENT,
        periodType: "monthly",
        startsAt: monthStart,
        status: "open",
      },
      {
        currency: "USD",
        endsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        id: PERIOD_PREV,
        periodType: "monthly",
        startsAt: prevStart,
        status: "finalized",
      },
    ]);

    await db.insert(qualifiedStreams).values([
      {
        accountingPeriodId: PERIOD_CURRENT,
        id: "db-test-qual-current-a",
        qualificationWindowKey: "w-1",
        qualifiedAt: monthStart,
        ruleVersion: 1,
        sourceId: "bio:testartist",
        sourceType: "artist_profile",
        status: "qualified",
        trackId: TRACK_LONG,
        userId: LISTENER_A,
      },
      {
        accountingPeriodId: PERIOD_CURRENT,
        id: "db-test-qual-current-b",
        qualificationWindowKey: "w-1",
        qualifiedAt: monthStart,
        ruleVersion: 1,
        sourceId: "bio:testartist",
        sourceType: "artist_profile",
        status: "qualified",
        trackId: TRACK_LONG,
        userId: LISTENER_B,
      },
      {
        accountingPeriodId: PERIOD_CURRENT,
        id: "db-test-qual-held",
        qualificationWindowKey: "w-1-held",
        qualifiedAt: monthStart,
        ruleVersion: 1,
        sourceType: "playlist",
        status: "held",
        trackId: TRACK_LONG,
        userId: LISTENER_B,
      },
      {
        accountingPeriodId: PERIOD_PREV,
        id: "db-test-qual-prev-a",
        qualificationWindowKey: "w-1-prev",
        qualifiedAt: prevStart,
        ruleVersion: 1,
        sourceType: "playlist",
        status: "qualified",
        trackId: TRACK_LONG,
        userId: LISTENER_A,
      },
    ]);

    await db.insert(subscriptionRewardAllocations).values([
      {
        accountingPeriodId: PERIOD_CURRENT,
        allocationStatus: "funded",
        creatorAllocationCents: 500,
        grossSubscriptionAmountCents: 1000,
        id: "db-test-alloc-current-a",
        subscriptionPeriodStart: monthStart,
        userId: LISTENER_A,
      },
      {
        accountingPeriodId: PERIOD_PREV,
        allocationStatus: "funded",
        creatorAllocationCents: 500,
        grossSubscriptionAmountCents: 1000,
        id: "db-test-alloc-prev-b",
        subscriptionPeriodStart: prevStart,
        userId: LISTENER_B,
      },
    ]);

    await db.insert(creatorEarnings).values([
      {
        accountingPeriodId: PERIOD_CURRENT,
        artistUserId: ARTIST_ID,
        currency: "USD",
        earningType: "premium_stream_reward",
        grossAmountCents: 1000,
        id: "db-test-earn-current-est",
        status: "estimated",
        trackId: TRACK_LONG,
      },
      {
        accountingPeriodId: PERIOD_PREV,
        artistUserId: ARTIST_ID,
        currency: "USD",
        earningType: "premium_stream_reward",
        grossAmountCents: 500,
        id: "db-test-earn-prev-est",
        status: "estimated",
        trackId: TRACK_LONG,
      },
      {
        accountingPeriodId: PERIOD_CURRENT,
        artistUserId: ARTIST_ID,
        currency: "USD",
        earningType: "premium_stream_reward",
        grossAmountCents: 3000,
        id: "db-test-earn-payable",
        payableAmountCents: 3000,
        status: "payable",
        trackId: TRACK_LONG,
      },
      {
        accountingPeriodId: PERIOD_CURRENT,
        artistUserId: ARTIST_ID,
        currency: "USD",
        earningType: "tip",
        grossAmountCents: 900,
        id: "db-test-earn-paid",
        status: "paid",
        trackId: TRACK_LONG,
      },
    ]);
  },
  cleanupBaseline = async () => {
    const testIds = sql`id like 'db-test-%'`;
    for (const table of [
      creatorEarnings,
      subscriptionRewardAllocations,
      qualifiedStreams,
      accountingPeriods,
      playbackSessions,
      trackAssets,
      tracks,
    ]) {
      await db.delete(table).where(testIds);
    }
    await db.delete(userProfiles).where(sql`user_id like 'db-test-%'`);
    await db.delete(user).where(sql`id like 'db-test-%'`);
  };

beforeAll(async () => {
  if (dbConnected) {
    const { createDb: create } = await import("@soundkit/db");
    db = create();
    await cleanupBaseline();
    await seedBaseline();
  }
});

afterAll(async () => {
  if (db) {
    await cleanupBaseline();
  }
});

describe.skipIf(!dbConnected)("analytics routes against local Postgres", () => {
  it("timeseries responds 200 without GROUP BY 1 regression across ranges and metrics", async () => {
    const app = makeApp(ARTIST_ID),
      ranges = ["7d", "28d", "90d", "12m"] as const,
      metrics = ["plays", "qualified_streams", "unique_listeners"] as const;

    for (const range of ranges) {
      for (const metric of metrics) {
        const response = await app.request(
          `/v1/analytics/timeseries?metric=${metric}&range=${range}`
        );
        expect(response.status).toBe(200);

        const body = (await response.json()) as {
          points: { date: string; label: string; value: number }[];
          range: string;
          total: number;
        };
        expect(body.points.length).toBe(
          range === "12m" ? 12 : range === "7d" ? 7 : range === "28d" ? 28 : 90
        );
        expect(body.points.every((p) => Number.isInteger(p.value))).toBe(true);
      }
    }
  });

  it("timeseries plays metric applies the 30s rule with short-track 95% fallback", async () => {
    const app = makeApp(ARTIST_ID),
      response = await app.request(
        "/v1/analytics/timeseries?metric=plays&range=90d"
      ),
      body = (await response.json()) as {
        total: number;
        points: { value: number }[];
      };

    // Long track: 29s is excluded, two clear 30s+ plays count, and the
    // risk-rejected 40s session is excluded. Short track: 18s (<95%) is
    // excluded, while 19s (>=95% of 20s) counts.
    expect(body.total).toBe(3);
    expect(body.points.reduce((acc, p) => acc + p.value, 0)).toBe(3);
  });

  it("timeseries qualified_streams counts only accepted streams", async () => {
    const app = makeApp(ARTIST_ID),
      response = await app.request(
        "/v1/analytics/timeseries?metric=qualified_streams&range=90d"
      ),
      body = (await response.json()) as { total: number };

    // Two qualified + one held excluded; the prior-period qualified stream
    // for LISTENER_A is outside the 90d window only if before it - it's
    // within 90d, so counts. But LISTENER_B also has a held row (excluded).
    expect(body.total).toBe(3);
  });

  it("timeseries unique_listeners counts distinct users", async () => {
    const app = makeApp(ARTIST_ID),
      response = await app.request(
        "/v1/analytics/timeseries?metric=unique_listeners&range=90d"
      ),
      body = (await response.json()) as { total: number };

    // LISTENER_A and LISTENER_B on the long track, LISTENER_A on short track.
    expect(body.total).toBe(2);
  });

  it("overview reports plays, qualified streams, and MTD earnings scoped to the open period", async () => {
    const app = makeApp(ARTIST_ID),
      response = await app.request("/v1/analytics/overview");
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      estimatedEarningsCents: number;
      premiumSupporters: number;
      totalPlays: number;
      totalQualifiedStreams: number;
      uniqueListeners: number;
    };

    expect(body.totalPlays).toBe(3);
    // All-time qualified+clear across artist tracks: current-a, current-b,
    // and the prior-period prev-a (overview has no date window).
    expect(body.totalQualifiedStreams).toBe(3);
    expect(body.uniqueListeners).toBe(2);
    // Only the current open period estimated reward counts (1000), not the
    // prior period's estimated 500.
    expect(body.estimatedEarningsCents).toBe(1000);
    // LISTENER_A is a current-period funded supporter; LISTENER_B's allocation
    // belongs to the prior period and must not match the current qualified stream.
    expect(body.premiumSupporters).toBe(1);
  });

  it("scopes Bio analytics to playback attributed to the artist Bio URL", async () => {
    const app = makeApp(ARTIST_ID),
      response = await app.request("/v1/analytics/overview?scope=bio"),
      body = (await response.json()) as {
        totalPlays: number;
        totalQualifiedStreams: number;
        uniqueListeners: number;
      };

    expect(response.status).toBe(200);
    expect(body.totalPlays).toBe(2);
    expect(body.totalQualifiedStreams).toBe(2);
    expect(body.uniqueListeners).toBe(2);
  });

  it("recent plays only includes the authenticated user's 30-second plays", async () => {
    const app = makeApp(LISTENER_A),
      response = await app.request("/v1/library/recent"),
      body = (await response.json()) as {
        id: string;
        timesPlayed: number;
      }[];

    expect(response.status).toBe(200);
    expect(body.map((track) => track.id)).toEqual([TRACK_LONG]);
    expect(body[0]?.timesPlayed).toBe(1);
  });

  it("track performance returns shared artwork resolver URLs and null fallback", async () => {
    const app = makeApp(ARTIST_ID),
      response = await app.request("/v1/analytics/tracks");
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
        tracks: {
          coverArtUrl: string | null;
          durationSeconds: number | null;
          plays: number;
          title: string;
          trackId: string;
        }[];
      },
      byId = new Map(body.tracks.map((t) => [t.trackId, t]));

    // cover_art is preferred over artwork, and its durable object key is
    // resolved against the active media host instead of stale metadata URLs.
    expect(byId.get(TRACK_LONG)?.coverArtUrl).toBe(
      "https://media.example.test/long-cover.png"
    );
    expect(byId.get(TRACK_LONG)?.durationSeconds).toBe(180);
    expect(byId.get(TRACK_SHORT)?.coverArtUrl).toBeNull();
    expect(byId.get(TRACK_NO_ASSETS)?.coverArtUrl).toBeNull();
  });

  it("earnings scopes estimated rewards to the open period and uses payable for progress", async () => {
    const app = makeApp(ARTIST_ID),
      response = await app.request("/v1/analytics/earnings");
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      availableBalanceCents: number;
      estimatedThisMonthCents: number;
      paidLifetimeCents: number;
      payoutMinimumCents: number;
      payoutProgressPercent: number;
      pendingReserveCents: number;
    };

    // Estimated only from the current open period (1000), prior -estimated is
    // excluded. Paid lifetime is 900. Payable 3000 drives 100% progress.
    expect(body.estimatedThisMonthCents).toBe(1000);
    expect(body.paidLifetimeCents).toBe(900);
    expect(body.availableBalanceCents).toBe(3000);
    expect(body.payoutMinimumCents).toBe(2500);
    expect(body.payoutProgressPercent).toBe(100);
    expect(body.pendingReserveCents).toBe(0);
  });
});
