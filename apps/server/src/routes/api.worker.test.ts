/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const jsonRequest = (method: string, body: unknown) => ({
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
    method,
  }),
  readJson = <T>(response: Response): Promise<T> =>
    response.json() as Promise<T>,
  bytesToHex = (bytes: Uint8Array) =>
    [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
  stripeSignature = async ({
    payload,
    timestamp = Math.floor(Date.now() / 1000),
  }: {
    payload: string;
    timestamp?: number;
  }) => {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode("whsec_soundkit_commerce_test"),
        { hash: "SHA-256", name: "HMAC" },
        false,
        ["sign"]
      ),
      digest = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`${timestamp}.${payload}`)
      );

    return `t=${timestamp},v1=${bytesToHex(new Uint8Array(digest))}`;
  };

describe("SoundKit Worker API", () => {
  it("exposes service health metadata", async () => {
    const response = await SELF.fetch("http://soundkit.test/health"),
      body = await readJson<{
        ok: boolean;
        service: string;
      }>(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("soundkit-api");
  });

  it("publishes an OpenAPI document", async () => {
    const response = await SELF.fetch("http://soundkit.test/api/openapi.json"),
      body = await readJson<{
        info: { title: string };
        openapi: string;
      }>(response);

    expect(response.status).toBe(200);
    expect(body.openapi).toBe("3.1.0");
    expect(body.info.title).toBe("SoundKit API");
  });

  it("verifies Stripe commerce webhooks without requiring storage", async () => {
    const payload = JSON.stringify({
        data: { object: {} },
        type: "checkout.session.completed",
      }),
      response = await SELF.fetch(
        "http://soundkit.test/v1/webhooks/stripe-commerce",
        {
          body: payload,
          headers: {
            "stripe-signature": await stripeSignature({ payload }),
          },
          method: "POST",
        }
      ),
      body = await readJson<{ message: string }>(response);

    expect(response.status).toBe(200);
    expect(body.message).toBe("Stripe webhook accepted.");
  });

  it.each([
    ["missing", undefined],
    ["invalid", "t=100,v1=invalid"],
  ])("rejects %s Stripe webhook signatures", async (_label, signature) => {
    const response = await SELF.fetch(
      "http://soundkit.test/v1/webhooks/stripe-commerce",
      {
        body: JSON.stringify({ id: "evt_invalid" }),
        headers: signature ? { "stripe-signature": signature } : undefined,
        method: "POST",
      }
    );

    expect(response.status).toBe(400);
  });

  it("rejects correctly signed but stale Stripe webhooks", async () => {
    const payload = JSON.stringify({ id: "evt_stale" }),
      response = await SELF.fetch(
        "http://soundkit.test/v1/webhooks/stripe-commerce",
        {
          body: payload,
          headers: {
            "stripe-signature": await stripeSignature({
              payload,
              timestamp: Math.floor(Date.now() / 1000) - 301,
            }),
          },
          method: "POST",
        }
      );

    expect(response.status).toBe(400);
  });

  it("allows the configured browser origin for credentialed auth requests", async () => {
    const response = await SELF.fetch("http://soundkit.test/auth/session", {
      headers: {
        "access-control-request-method": "GET",
        origin: "http://127.0.0.1:3001",
      },
      method: "OPTIONS",
    });

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://127.0.0.1:3001"
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true"
    );
  });

  it("caches allowlisted public catalog reads without caching CORS headers", async () => {
    const url = `http://soundkit.test/v1/discover/genres?cacheTest=${crypto.randomUUID()}`,
      first = await SELF.fetch(url, {
        headers: { Origin: "http://127.0.0.1:3001" },
      }),
      second = await SELF.fetch(url, {
        headers: { Origin: "http://127.0.0.1:3001" },
      });

    expect(first.status).toBe(200);
    expect(first.headers.get("x-soundkit-cache")).toBe("MISS");
    expect(first.headers.get("cache-control")).toContain("max-age=0");
    expect(second.headers.get("x-soundkit-cache")).toBe("HIT");
    expect(second.headers.get("cache-control")).toContain("max-age=0");
    expect(second.headers.get("access-control-allow-origin")).toBe(
      "http://127.0.0.1:3001"
    );
  });

  it("returns discovery and catalog read models when storage is not configured", async () => {
    const [
      genresResponse,
      tracksResponse,
      videosResponse,
      battlesResponse,
      projectsResponse,
    ] = await Promise.all([
      SELF.fetch("http://soundkit.test/v1/discover/genres"),
      SELF.fetch("http://soundkit.test/v1/tracks"),
      SELF.fetch("http://soundkit.test/v1/videos"),
      SELF.fetch("http://soundkit.test/v1/battles"),
      SELF.fetch(
        "http://soundkit.test/v1/projects/public?regionType=north-america&region=us-arkansas&type=ep"
      ),
    ]);

    expect(genresResponse.status).toBe(200);
    expect(tracksResponse.status).toBe(200);
    expect(videosResponse.status).toBe(200);
    expect(battlesResponse.status).toBe(200);
    expect(projectsResponse.status).toBe(200);

    const tracks = await readJson<unknown[]>(tracksResponse),
      videos = await readJson<unknown[]>(videosResponse),
      battles = await readJson<unknown[]>(battlesResponse),
      projects = await readJson<
        {
          genre: string | null;
          projectType: string;
          regionSlug: string | null;
        }[]
      >(projectsResponse);

    expect(tracks).toEqual([]);
    expect(videos.length).toBeGreaterThan(0);
    expect(battles.length).toBeGreaterThan(0);
    expect(projects).toEqual([
      expect.objectContaining({
        genre: "R&B/Soul",
        projectType: "ep",
        regionSlug: "us-ar",
      }),
    ]);
  });

  it("accepts first-party video telemetry without storage", async () => {
    const sessionResponse = await SELF.fetch(
        "http://soundkit.test/v1/videos/video_midnight_vibes_mv/view-sessions",
        {
          body: JSON.stringify({ anonymousId: "browser-test-viewer" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      ),
      session = await readJson<{ id: string; token: string }>(sessionResponse),
      progressResponse = await SELF.fetch(
        `http://soundkit.test/v1/videos/video_midnight_vibes_mv/view-sessions/${session.id}/progress`,
        {
          body: JSON.stringify({
            playedSeconds: 5,
            token: session.token,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      ),
      progress = await readJson<{ updated: boolean }>(progressResponse);

    expect(sessionResponse.status).toBe(201);
    expect(session.id).toEqual(expect.any(String));
    expect(session.token).toEqual(expect.any(String));
    expect(progressResponse.status).toBe(200);
    expect(progress).toEqual({ updated: false });
  });

  it("keeps public projects visible for continent discovery filters", async () => {
    const [northAmericaResponse, globalResponse, usaResponse] =
        await Promise.all([
          SELF.fetch(
            "http://soundkit.test/v1/projects/public?region=all&regionType=north-america"
          ),
          SELF.fetch(
            "http://soundkit.test/v1/projects/public?region=all&regionType=global"
          ),
          SELF.fetch(
            "http://soundkit.test/v1/projects/public?region=usa&regionType=north-america"
          ),
        ]),
      northAmericaProjects = await readJson<unknown[]>(northAmericaResponse),
      globalProjects = await readJson<unknown[]>(globalResponse),
      usaProjects = await readJson<unknown[]>(usaResponse);

    expect(northAmericaResponse.status).toBe(200);
    expect(globalResponse.status).toBe(200);
    expect(usaResponse.status).toBe(200);
    expect(northAmericaProjects).toHaveLength(1);
    expect(globalProjects).toHaveLength(1);
    expect(usaProjects).toHaveLength(1);
  });

  it("filters public projects by sale state in no-storage mode", async () => {
    const response = await SELF.fetch(
        "http://soundkit.test/v1/projects/public?forSale=true"
      ),
      projects = await readJson<unknown[]>(response);

    expect(response.status).toBe(200);
    expect(projects).toEqual([]);
  });

  it("reports live room state as unavailable without a Durable Object binding", async () => {
    const partyResponse = await SELF.fetch(
        "http://soundkit.test/v1/live/rooms/single-album-party"
      ),
      battleResponse = await SELF.fetch(
        "http://soundkit.test/v1/live/rooms/battle-1"
      ),
      party = await readJson<{ message: string }>(partyResponse),
      battle = await readJson<{ message: string }>(battleResponse);

    expect(partyResponse.status).toBe(503);
    expect(party.message).toContain("Durable Object");
    expect(battleResponse.status).toBe(503);
    expect(battle.message).toContain("Durable Object");
  });

  it("keeps dashboard and commerce mutations behind authentication", async () => {
    const createTrackResponse = await SELF.fetch(
        "http://soundkit.test/v1/tracks",
        jsonRequest("POST", {
          assetIds: [],
          catalogItemType: "single",
          genre: "Hip-Hop",
          isForSale: false,
          isPublic: false,
          productionStatus: "demo",
          purchaseMode: "digital_download",
          releaseStrategy: "private",
          title: "Worker Test Track",
        })
      ),
      cartResponse = await SELF.fetch("http://soundkit.test/v1/cart"),
      friendsResponse = await SELF.fetch(
        "http://soundkit.test/v1/messages/friends"
      ),
      conversationsResponse = await SELF.fetch(
        "http://soundkit.test/v1/messages/conversations"
      ),
      conversationMessagesResponse = await SELF.fetch(
        "http://soundkit.test/v1/messages/conversations/conv_sarah/messages"
      ),
      checkoutResponse = await SELF.fetch(
        "http://soundkit.test/v1/billing/checkout",
        jsonRequest("POST", {
          cancelUrl: "http://127.0.0.1:3001/pricing",
          planCode: "soundkit_premium_artist",
          successUrl: "http://127.0.0.1:3001/dashboard",
        })
      );

    expect(createTrackResponse.status).toBe(401);
    expect(cartResponse.status).toBe(401);
    expect(friendsResponse.status).toBe(401);
    expect(conversationsResponse.status).toBe(401);
    expect(conversationMessagesResponse.status).toBe(401);
    expect(checkoutResponse.status).toBe(401);
  });

  it("reports upload routes as unavailable until storage credentials are bound", async () => {
    const statusResponse = await SELF.fetch("http://soundkit.test/v1/uploads"),
      uploadResponse = await SELF.fetch(
        "http://soundkit.test/v1/uploads/track-source",
        {
          method: "POST",
        }
      ),
      statusBody = await readJson<{ message: string }>(statusResponse),
      uploadBody = await readJson<{ message: string }>(uploadResponse);

    expect(statusResponse.status).toBe(200);
    expect(statusBody.message).toContain("UPLOAD_BUCKET_NAME");
    expect(uploadResponse.status).toBe(503);
    expect(uploadBody.message).toContain("not configured");
  });

  it("exposes the full genre catalog even when the database is not configured", async () => {
    const response = await SELF.fetch(
        "http://soundkit.test/v1/discover/genres"
      ),
      body = await readJson<{ name: string; slug: string }[]>(response);

    expect(response.status).toBe(200);
    expect(body.length).toBeGreaterThanOrEqual(9);
    expect(body.map((genre) => genre.slug)).toEqual(
      expect.arrayContaining([
        "afrobeats",
        "electronic",
        "hip-hop",
        "jazz",
        "latin",
        "pop",
        "rb-soul",
        "rock",
        "spoken-word",
      ])
    );
  });

  it("guards live battle creation behind signed-in premium artist access", async () => {
    const response = await SELF.fetch(
        "http://soundkit.test/v1/battles/challenge",
        jsonRequest("POST", {
          format: "best_of_3",
          genre: "Hip-Hop",
          opponentUsername: "rival-artist",
        })
      ),
      body = await readJson<{ message: string }>(response);

    expect(response.status).toBe(401);
    expect(body.message).toContain("Authentication");
  });

  it("guards battle lyric eligibility checks behind authentication", async () => {
    const response = await SELF.fetch(
      "http://soundkit.test/v1/battles/eligibility",
      jsonRequest("POST", {
        trackIds: ["track_123"],
      })
    );

    expect(response.status).toBe(401);
  });

  it("guards lyric revision submission behind authentication", async () => {
    const response = await SELF.fetch(
      "http://soundkit.test/v1/tracks/track_123/lyrics",
      jsonRequest("POST", {
        text: "Test lyric",
        timedLines: [{ endMs: 1000, startMs: 0, text: "Test lyric" }],
      })
    );

    expect(response.status).toBe(401);
  });

  it("returns no approved public lyrics when storage is not configured", async () => {
    const response = await SELF.fetch(
        "http://soundkit.test/v1/tracks/track_123/lyrics"
      ),
      body = await readJson<unknown>(response);

    expect(response.status).toBe(200);
    expect(body).toBeNull();
  });

  it("guards fan lyric suggestions behind authentication", async () => {
    const response = await SELF.fetch(
      "http://soundkit.test/v1/tracks/track_123/lyrics/suggestions",
      jsonRequest("POST", {
        text: "Suggested lyric",
        timedLines: [{ endMs: 1000, startMs: 0, text: "Suggested lyric" }],
      })
    );

    expect(response.status).toBe(401);
  });

  it("guards direct video uploads behind authentication", async () => {
    const response = await SELF.fetch(
      "http://soundkit.test/v1/videos/direct-upload",
      jsonRequest("POST", {
        playbackPolicy: "public",
        sourceTrackId: "track_123",
        title: "Official Video",
      })
    );

    expect(response.status).toBe(401);
  });
});
