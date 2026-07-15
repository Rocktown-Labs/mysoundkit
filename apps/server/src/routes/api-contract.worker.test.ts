/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { SELF } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

const API_ORIGIN = "http://soundkit.test";

const jsonRequest = (body: unknown, method = "POST"): RequestInit => ({
  body: JSON.stringify(body),
  headers: {
    "content-type": "application/json",
  },
  method,
});

const fetchJson = async <T>(path: string, init?: RequestInit) => {
  const response = await SELF.fetch(`${API_ORIGIN}${path}`, init);
  const body = (await response.json()) as T;

  return { body, response };
};

const publicReadCases = [
  ["/v1/artists", "array"],
  ["/v1/artists/luna-eclipse", "object"],
  ["/v1/tracks", "array"],
  ["/v1/tracks/track_midnight_vibes", "object"],
  ["/v1/tracks/track_midnight_vibes/lyrics", "nullable"],
  ["/v1/projects", "array"],
  ["/v1/projects/project_after_dark", "object"],
  ["/v1/videos", "array"],
  ["/v1/videos/video_midnight_vibes_mv", "object"],
  ["/v1/playlists", "array"],
  ["/v1/playlists/playlist_after_hours", "object"],
  ["/v1/battles", "array"],
  ["/v1/battles/battle_west_coast_showdown", "object"],
  ["/v1/library/recent", "array"],
  ["/v1/library/saved", "array"],
  ["/v1/library/watched", "array"],
  ["/v1/library/purchases", "array"],
  ["/v1/social/posts/post_1/comments", "array"],
  ["/v1/analytics/overview", "object"],
] as const;

const expectedOpenApiOperations = [
  ["get", "/v1/analytics/overview"],
  ["get", "/v1/artists"],
  ["get", "/v1/artists/{username}"],
  ["get", "/v1/battles"],
  ["post", "/v1/battles/challenge"],
  ["post", "/v1/battles/eligibility"],
  ["get", "/v1/battles/{battleId}"],
  ["get", "/v1/admin/finance/summary"],
  ["post", "/v1/billing/checkout"],
  ["get", "/v1/billing/plans"],
  ["get", "/v1/billing/subscription"],
  ["delete", "/v1/cart"],
  ["get", "/v1/cart"],
  ["post", "/v1/cart/claim"],
  ["post", "/v1/cart/items"],
  ["delete", "/v1/cart/items/{cartItemId}"],
  ["patch", "/v1/cart/items/{cartItemId}"],
  ["post", "/v1/community-billing/checkout"],
  ["get", "/v1/communities"],
  ["post", "/v1/communities"],
  ["get", "/v1/communities/{communityId}/analytics"],
  ["get", "/v1/communities/{communityId}/members"],
  ["delete", "/v1/communities/{communityId}/members/{userId}"],
  ["patch", "/v1/communities/{communityId}/members/{userId}"],
  ["get", "/v1/communities/{communityId}/messages"],
  ["post", "/v1/communities/{communityId}/messages"],
  ["get", "/v1/communities/{communityId}/posts"],
  ["post", "/v1/communities/{communityId}/posts"],
  ["get", "/v1/discover/home"],
  ["get", "/v1/library/overview"],
  ["get", "/v1/library/purchases"],
  ["get", "/v1/library/recent"],
  ["get", "/v1/library/saved"],
  ["get", "/v1/library/watched"],
  ["get", "/v1/me"],
  ["get", "/v1/me/entitlements"],
  ["patch", "/v1/me/profile"],
  ["get", "/v1/me/workspaces"],
  ["get", "/v1/messages/conversations"],
  ["get", "/v1/messages/friends"],
  ["post", "/v1/messages/conversations"],
  ["get", "/v1/messages/conversations/{conversationId}/messages"],
  ["post", "/v1/messages/conversations/{conversationId}/messages"],
  ["post", "/v1/onboarding/artist"],
  ["post", "/v1/onboarding/fan"],
  ["get", "/v1/onboarding/username-availability"],
  ["get", "/v1/playlists"],
  ["post", "/v1/playlists"],
  ["post", "/v1/payments/checkout"],
  ["post", "/v1/payments/tips"],
  ["get", "/v1/playlists/{playlistId}"],
  ["get", "/v1/projects"],
  ["post", "/v1/projects"],
  ["delete", "/v1/projects/{projectId}"],
  ["get", "/v1/projects/{projectId}"],
  ["patch", "/v1/projects/{projectId}"],
  ["post", "/v1/seller/account-link"],
  ["get", "/v1/seller/status"],
  ["get", "/v1/social/posts/{postId}/comments"],
  ["post", "/v1/social/posts/{postId}/comments"],
  ["post", "/v1/social/posts/{postId}/likes"],
  ["get", "/v1/tracks"],
  ["post", "/v1/tracks"],
  ["post", "/v1/tracks/{trackId}/assets"],
  ["delete", "/v1/tracks/{trackId}"],
  ["get", "/v1/tracks/{trackId}"],
  ["patch", "/v1/tracks/{trackId}"],
  ["get", "/v1/tracks/{trackId}/lyrics"],
  ["post", "/v1/tracks/{trackId}/lyrics"],
  ["post", "/v1/tracks/{trackId}/lyrics/suggestions"],
  ["patch", "/v1/tracks/{trackId}/lyrics/{lyricsId}"],
  ["post", "/v1/tracks/{trackId}/process"],
  ["get", "/v1/uploads"],
  ["get", "/v1/videos"],
  ["post", "/v1/videos"],
  ["post", "/v1/videos/direct-upload"],
  ["get", "/v1/videos/{videoId}"],
  ["post", "/v1/webhooks/battle-service"],
  ["post", "/v1/webhooks/mux"],
  ["post", "/v1/webhooks/stemsplit"],
  ["post", "/v1/webhooks/stripe"],
  ["post", "/v1/webhooks/stripe-commerce"],
] as const;

describe("SoundKit API HTTP contracts", () => {
  it("propagates request IDs through the structured logging middleware", async () => {
    const { body, response } = await fetchJson<{ requestId: string }>(
      "/health",
      {
        headers: {
          "x-request-id": "request_from_test",
        },
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("request_from_test");
    expect(body.requestId).toBe("request_from_test");
  });

  it("returns JSON not-found responses for unknown API endpoints", async () => {
    const { body, response } = await fetchJson<{ message: string }>(
      "/v1/does-not-exist"
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body.message).toBe("Not Found - /v1/does-not-exist");
  });

  it("documents every mounted OpenAPI operation with tags and responses", async () => {
    const { body, response } = await fetchJson<{
      paths: Record<string, Record<string, unknown>>;
    }>("/api/openapi.json");

    expect(response.status).toBe(200);

    for (const [method, path] of expectedOpenApiOperations) {
      const operation = body.paths[path]?.[method] as
        | { responses?: unknown; tags?: unknown[] }
        | undefined;

      expect(operation, `${method.toUpperCase()} ${path}`).toBeDefined();
      expect(operation?.responses, `${method.toUpperCase()} ${path}`).toEqual(
        expect.objectContaining({})
      );
      expect(
        operation?.tags?.length,
        `${method.toUpperCase()} ${path}`
      ).toBeGreaterThan(0);
    }
  });

  it("keeps observability request IDs on success and error responses", async () => {
    const [success, validationError, authError, notFoundError] =
      await Promise.all([
        fetchJson<{ requestId: string }>("/health", {
          headers: { "x-request-id": "rid_success" },
        }),
        fetchJson<{ requestId: string }>("/v1/playlists", {
          body: "not-json",
          headers: {
            "content-type": "application/json",
            "x-request-id": "rid_validation",
          },
          method: "POST",
        }),
        fetchJson<{ message: string }>("/v1/me", {
          headers: { "x-request-id": "rid_auth" },
        }),
        fetchJson<{ message: string }>("/v1/not-a-route", {
          headers: { "x-request-id": "rid_404" },
        }),
      ]);

    expect(success.response.headers.get("x-request-id")).toBe("rid_success");
    expect(success.body.requestId).toBe("rid_success");
    expect(validationError.response.status).toBe(400);
    expect(validationError.response.headers.get("x-request-id")).toBe(
      "rid_validation"
    );
    expect(validationError.body.requestId).toBe("rid_validation");
    expect(authError.response.status).toBe(401);
    expect(authError.response.headers.get("x-request-id")).toBe("rid_auth");
    expect(notFoundError.response.status).toBe(404);
    expect(notFoundError.response.headers.get("x-request-id")).toBe("rid_404");
  });

  it("emits structured request logs for observability pipelines", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const response = await SELF.fetch(`${API_ORIGIN}/health`, {
        headers: { "x-request-id": "rid_log" },
      });

      expect(response.status).toBe(200);

      const entries = logSpy.mock.calls
        .map(([line]) => {
          try {
            return JSON.parse(String(line)) as Record<string, unknown>;
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      const requestEntry = entries.find(
        (entry) => entry?.requestId === "rid_log"
      );

      expect(requestEntry).toEqual(
        expect.objectContaining({
          durationMs: expect.any(Number),
          level: "info",
          method: "GET",
          path: "/health",
          service: "soundkit-api",
          status: 200,
          timestamp: expect.any(String),
        })
      );
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe("SoundKit public read API", () => {
  it.each(publicReadCases)(
    "returns a stable fallback read model for GET %s",
    async (path, shape) => {
      const { body, response } = await fetchJson<unknown>(path);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json"
      );

      if (shape === "array") {
        expect(Array.isArray(body)).toBe(true);
        expect((body as unknown[]).length).toBeGreaterThan(0);
        return;
      }

      if (shape === "nullable") {
        expect(body === null || typeof body === "object").toBe(true);
        return;
      }

      expect(body).toEqual(expect.any(Object));
    }
  );

  it("returns the assembled discovery landing response", async () => {
    const { body, response } = await fetchJson<{
      featuredArtists: unknown[];
      featuredBattles: unknown[];
      featuredTracks: unknown[];
    }>("/v1/discover/home");

    expect(response.status).toBe(200);
    expect(body.featuredArtists.length).toBeGreaterThan(0);
    expect(body.featuredBattles.length).toBeGreaterThan(0);
    expect(body.featuredTracks.length).toBeGreaterThan(0);
  });

  it("returns public explore read models for songs videos and ranked artists", async () => {
    const [tracksResult, videosResult, artistsResult] = await Promise.all([
      fetchJson<
        {
          artistName: string;
          id: string;
          plays: number;
          title: string;
        }[]
      >("/v1/tracks?scope=public&region=us-arkansas&limit=6"),
      fetchJson<
        {
          creatorName?: string;
          duration?: string;
          thumbnailUrl?: string | null;
          viewCount?: string;
        }[]
      >("/v1/videos?scope=public&region=us-arkansas&limit=6"),
      fetchJson<
        {
          avatarUrl?: string | null;
          name: string;
          rank?: number;
          username: string;
        }[]
      >("/v1/artists?category=top&region=us-arkansas&limit=10"),
    ]);

    expect(tracksResult.response.status).toBe(200);
    expect(tracksResult.body[0]).toEqual(
      expect.objectContaining({
        artistName: expect.any(String),
        id: expect.any(String),
        plays: expect.any(Number),
        title: expect.any(String),
      })
    );
    expect(videosResult.response.status).toBe(200);
    expect(videosResult.body[0]).toEqual(
      expect.objectContaining({
        creatorName: expect.any(String),
        duration: expect.any(String),
        thumbnailUrl: expect.any(String),
        viewCount: expect.any(String),
      })
    );
    expect(artistsResult.response.status).toBe(200);
    expect(artistsResult.body[0]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        rank: 1,
        username: expect.any(String),
      })
    );
  });

  it("returns battle feed metadata for featured and genre rails", async () => {
    const { body, response } = await fetchJson<
      {
        featuredRank?: number | null;
        genre: string;
        isFeatured: boolean;
        status: string;
        viewerCount: number;
      }[]
    >("/v1/battles");

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          genre: "Hip-Hop",
          isFeatured: true,
          status: "live",
        }),
        expect.objectContaining({
          genre: "Spoken Word",
        }),
      ])
    );
    expect(body.find((battle) => battle.isFeatured)?.featuredRank).toEqual(
      expect.any(Number)
    );
  });

  it("returns billing plans and library summaries without storage", async () => {
    const [plansResult, overviewResult, purchasesResult, watchedResult] =
      await Promise.all([
        fetchJson<
          {
            annualPriceCents: number | null;
            code: string;
            maxSeats: number | null;
            monthlyPriceCents: number;
          }[]
        >("/v1/billing/plans"),
        fetchJson<{
          playlistCount: number;
          purchaseCount: number;
          watchedCount?: number;
        }>("/v1/library/overview"),
        fetchJson<unknown[]>("/v1/library/purchases"),
        fetchJson<{ type: string; watchedAt: string }[]>("/v1/library/watched"),
      ]);

    expect(plansResult.response.status).toBe(200);
    expect(plansResult.body).toHaveLength(6);
    expect(plansResult.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          annualPriceCents: null,
          code: "soundkit_premium_artist",
          maxSeats: 1,
          monthlyPriceCents: 2299,
        }),
        expect.objectContaining({
          annualPriceCents: null,
          code: "soundkit_premium_fan",
          maxSeats: 1,
          monthlyPriceCents: 2299,
        }),
        expect.objectContaining({
          annualPriceCents: null,
          code: "artist_team",
          maxSeats: 5,
          monthlyPriceCents: 2499,
        }),
        expect.objectContaining({
          annualPriceCents: null,
          code: "fan_family",
          maxSeats: 5,
          monthlyPriceCents: 2499,
        }),
      ])
    );
    expect(plansResult.body.map((plan) => plan.code)).not.toEqual(
      expect.arrayContaining(["artist_lite_ads", "fan_lite_ads"])
    );
    expect(overviewResult.response.status).toBe(200);
    expect(overviewResult.body.playlistCount).toEqual(expect.any(Number));
    expect(overviewResult.body.purchaseCount).toEqual(expect.any(Number));
    expect(overviewResult.body.watchedCount).toEqual(expect.any(Number));
    expect(purchasesResult.response.status).toBe(200);
    expect(purchasesResult.body.length).toBeGreaterThan(0);
    expect(watchedResult.response.status).toBe(200);
    expect(watchedResult.body[0]).toEqual(
      expect.objectContaining({
        type: expect.stringMatching(/battle|video|stream/u),
        watchedAt: expect.any(String),
      })
    );
  });
});

describe("SoundKit public write API", () => {
  it("creates a playlist from a validated JSON request", async () => {
    const { body, response } = await fetchJson<{
      description: string | null;
      id: string;
      isPublic: boolean;
      title: string;
      trackCount: number;
    }>(
      "/v1/playlists",
      jsonRequest({
        isPublic: true,
        title: "Test Listening Queue",
      })
    );

    expect(response.status).toBe(201);
    expect(body).toEqual({
      description: null,
      id: "playlist_new",
      isPublic: true,
      title: "Test Listening Queue",
      trackCount: 0,
    });
  });

  it("creates social comments from a validated JSON request", async () => {
    const commentResult = await fetchJson<{ body: string; id: string }>(
      "/v1/social/posts/post_1/comments",
      jsonRequest({ body: "Strong hook." })
    );

    expect(commentResult.response.status).toBe(201);
    expect(commentResult.body).toMatchObject({
      body: "Strong hook.",
      id: "comment_new",
    });
  });

  it("accepts onboarding payloads in the storage-free development environment", async () => {
    const { body, response } = await fetchJson<{
      message: string;
      requiresCheckout: boolean;
      setupRequired: boolean;
      workspaceId: string | null;
    }>(
      "/v1/onboarding/fan",
      jsonRequest({
        city: "Chicago",
        genrePreferences: ["House", "Hip-Hop", "Soul"],
        selectedPlanCode: "fan_free",
        state: "IL",
        username: "listener_test",
      })
    );

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      requiresCheckout: false,
      setupRequired: true,
      workspaceId: null,
    });
    expect(body.message).toContain("listener_test");
  });

  it("checks username availability and reserves SoundKit", async () => {
    const [availableResult, reservedResult] = await Promise.all([
      fetchJson<{
        available: boolean;
        reason: string;
        username: string;
      }>("/v1/onboarding/username-availability?username=listener_test"),
      fetchJson<{
        available: boolean;
        reason: string;
        username: string;
      }>("/v1/onboarding/username-availability?username=SoundKit"),
    ]);

    expect(availableResult.response.status).toBe(200);
    expect(availableResult.body).toMatchObject({
      available: true,
      reason: "available",
      username: "listener_test",
    });
    expect(reservedResult.response.status).toBe(200);
    expect(reservedResult.body).toMatchObject({
      available: false,
      reason: "reserved",
      username: "soundkit",
    });
  });

  it("rejects reserved usernames before accepting onboarding writes", async () => {
    const [artistResult, fanResult] = await Promise.all([
      fetchJson<{ message: string }>(
        "/v1/onboarding/artist",
        jsonRequest({
          city: "Little Rock",
          primaryGenre: "Hip-Hop",
          roles: ["musician"],
          selectedPlanCode: "artist_free",
          state: "AR",
          teamInviteEmails: [],
          username: "SoundKit",
        })
      ),
      fetchJson<{ message: string }>(
        "/v1/onboarding/fan",
        jsonRequest({
          city: "Little Rock",
          genrePreferences: ["Hip-Hop", "Soul", "Jazz"],
          selectedPlanCode: "fan_free",
          state: "AR",
          username: "soundkit",
        })
      ),
    ]);

    expect(artistResult.response.status).toBe(409);
    expect(artistResult.body.message).toBe("That username is reserved.");
    expect(fanResult.response.status).toBe(409);
    expect(fanResult.body.message).toBe("That username is reserved.");
  });

  it("rejects removed onboarding plan codes", async () => {
    const [artistResult, fanResult] = await Promise.all([
      fetchJson<{ success: boolean }>(
        "/v1/onboarding/artist",
        jsonRequest({
          city: "Little Rock",
          primaryGenre: "Hip-Hop",
          roles: ["musician"],
          selectedPlanCode: "artist_lite_ads",
          state: "AR",
          teamInviteEmails: [],
          username: "legacy_artist",
        })
      ),
      fetchJson<{ success: boolean }>(
        "/v1/onboarding/fan",
        jsonRequest({
          city: "Chicago",
          genrePreferences: ["House"],
          selectedPlanCode: "fan_lite_ads",
          state: "IL",
          username: "legacy_fan",
        })
      ),
    ]);

    expect(artistResult.response.status).toBe(400);
    expect(fanResult.response.status).toBe(400);
  });

  it.each([298, 10_000])(
    "rejects community prices outside the allowed range: %i cents",
    async (monthlyPriceCents) => {
      const result = await fetchJson<{ success: boolean }>(
        "/v1/communities",
        jsonRequest({ monthlyPriceCents, name: "Invalid Price Community" })
      );

      expect(result.response.status).toBe(400);
    }
  );
});

describe("SoundKit API input validation", () => {
  it.each([
    ["/v1/playlists", { title: "" }],
    ["/v1/social/posts/post_1/comments", { body: "" }],
    ["/v1/messages/conversations", { participantUserIds: [] }],
    ["/v1/onboarding/fan", { username: "x" }],
    ["/v1/onboarding/artist", { username: "bad-name" }],
  ])("rejects invalid POST input for %s", async (path, body) => {
    const result = await fetchJson<{ success: boolean }>(
      path,
      jsonRequest(body)
    );

    expect(result.response.status).toBe(400);
    expect(result.body.success).toBe(false);
  });

  it("rejects non-JSON request bodies on JSON endpoints", async () => {
    const { body, response } = await fetchJson<{
      code: string;
      message: string;
      requestId: string;
    }>("/v1/playlists", {
      body: "not json",
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: "bad_request",
      message: "Invalid request payload.",
      requestId: expect.any(String),
    });
  });

  it("validates username availability query params", async () => {
    const { body, response } = await fetchJson<{ success: boolean }>(
      "/v1/onboarding/username-availability?username=x"
    );

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });
});

describe("SoundKit provider endpoint configuration", () => {
  it.each([
    ["/v1/webhooks/mux", "Mux webhook verification is not configured."],
    [
      "/v1/webhooks/stemsplit",
      "StemSplit webhook verification is not configured.",
    ],
  ])("fails closed when POST %s is not configured", async (path, message) => {
    const { body, response } = await fetchJson<{ message: string }>(path, {
      method: "POST",
    });

    expect(response.status).toBe(503);
    expect(body.message).toBe(message);
  });

  it("keeps inert webhook acknowledgements available", async () => {
    const [stripeResult, battleResult] = await Promise.all([
      fetchJson<{ message: string }>("/v1/webhooks/stripe", {
        method: "POST",
      }),
      fetchJson<{ message: string }>("/v1/webhooks/battle-service", {
        method: "POST",
      }),
    ]);

    expect(stripeResult.response.status).toBe(200);
    expect(stripeResult.body.message).toBe("Stripe webhook accepted");
    expect(battleResult.response.status).toBe(200);
    expect(battleResult.body.message).toBe("Battle service webhook accepted");
  });
});
