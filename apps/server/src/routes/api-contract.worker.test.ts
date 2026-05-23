/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

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

  it("documents representative public, protected, upload, and webhook routes", async () => {
    const { body, response } = await fetchJson<{
      paths: Record<string, Record<string, unknown>>;
    }>("/api/openapi.json");
    const documentedOperations = [
      ["get", "/v1/discover/home"],
      ["post", "/v1/tracks"],
      ["post", "/v1/projects"],
      ["post", "/v1/videos/direct-upload"],
      ["post", "/v1/battles/challenge"],
      ["get", "/v1/uploads"],
      ["post", "/v1/webhooks/mux"],
    ] as const;

    expect(response.status).toBe(200);

    for (const [method, path] of documentedOperations) {
      expect(body.paths[path]).toHaveProperty(method);
    }
  });
});

describe("SoundKit public read API", () => {
  it.each([
    "/v1/artists",
    "/v1/tracks",
    "/v1/projects",
    "/v1/videos",
    "/v1/playlists",
    "/v1/battles",
    "/v1/library/recent",
  ])("returns a non-empty collection for GET %s", async (path) => {
    const { body, response } = await fetchJson<unknown[]>(path);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

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

  it("returns billing plans and library summaries without storage", async () => {
    const [plansResult, overviewResult, purchasesResult] = await Promise.all([
      fetchJson<{ code: string }[]>("/v1/billing/plans"),
      fetchJson<{ playlistCount: number; purchaseCount: number }>(
        "/v1/library/overview"
      ),
      fetchJson<unknown[]>("/v1/library/purchases"),
    ]);

    expect(plansResult.response.status).toBe(200);
    expect(plansResult.body.map((plan) => plan.code)).toContain("artist_free");
    expect(overviewResult.response.status).toBe(200);
    expect(overviewResult.body.playlistCount).toEqual(expect.any(Number));
    expect(overviewResult.body.purchaseCount).toEqual(expect.any(Number));
    expect(purchasesResult.response.status).toBe(200);
    expect(purchasesResult.body.length).toBeGreaterThan(0);
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

  it("creates social comments and conversation messages", async () => {
    const [commentResult, conversationResult, messageResult] =
      await Promise.all([
        fetchJson<{ body: string; id: string }>(
          "/v1/social/posts/post_1/comments",
          jsonRequest({ body: "Strong hook." })
        ),
        fetchJson<{ conversationType: string; title: string }>(
          "/v1/messages/conversations",
          jsonRequest({
            participantUserIds: ["artist_1", "artist_2"],
            title: "Collaboration",
          })
        ),
        fetchJson<{ body: string; status: string }>(
          "/v1/messages/conversations/conv_1/messages",
          jsonRequest({ body: "Sending stems tonight." })
        ),
      ]);

    expect(commentResult.response.status).toBe(201);
    expect(commentResult.body).toMatchObject({
      body: "Strong hook.",
      id: "comment_new",
    });
    expect(conversationResult.response.status).toBe(201);
    expect(conversationResult.body).toMatchObject({
      conversationType: "group",
      title: "Collaboration",
    });
    expect(messageResult.response.status).toBe(201);
    expect(messageResult.body).toMatchObject({
      body: "Sending stems tonight.",
      status: "sent",
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
        username: "listener-test",
      })
    );

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      requiresCheckout: false,
      setupRequired: true,
      workspaceId: null,
    });
    expect(body.message).toContain("listener-test");
  });
});

describe("SoundKit API input validation", () => {
  it.each([
    ["/v1/playlists", { title: "" }],
    ["/v1/social/posts/post_1/comments", { body: "" }],
    ["/v1/messages/conversations", { participantUserIds: [] }],
    ["/v1/onboarding/fan", { username: "x" }],
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
