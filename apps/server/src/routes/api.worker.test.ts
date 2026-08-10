/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const jsonRequest = (method: string, body: unknown) => ({
  body: JSON.stringify(body),
  headers: {
    "content-type": "application/json",
  },
  method,
});

const readJson = <T>(response: Response): Promise<T> =>
  response.json() as Promise<T>;

const bytesToHex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const stripeSignature = async ({
  payload,
  timestamp = Math.floor(Date.now() / 1000),
}: {
  payload: string;
  timestamp?: number;
}) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("whsec_soundkit_test"),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`)
  );

  return `t=${timestamp},v1=${bytesToHex(new Uint8Array(digest))}`;
};

describe("SoundKit Worker API", () => {
  it("exposes service health metadata", async () => {
    const response = await SELF.fetch("http://soundkit.test/health");
    const body = await readJson<{
      ok: boolean;
      service: string;
    }>(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("soundkit-api");
  });

  it("publishes an OpenAPI document", async () => {
    const response = await SELF.fetch("http://soundkit.test/api/openapi.json");
    const body = await readJson<{
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
    });
    const response = await SELF.fetch(
      "http://soundkit.test/v1/webhooks/stripe-commerce",
      {
        body: payload,
        headers: {
          "stripe-signature": await stripeSignature({ payload }),
        },
        method: "POST",
      }
    );
    const body = await readJson<{ message: string }>(response);

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
    const payload = JSON.stringify({ id: "evt_stale" });
    const response = await SELF.fetch(
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

  it("returns discovery and catalog read models when storage is not configured", async () => {
    const [
      discoverResponse,
      tracksResponse,
      videosResponse,
      battlesResponse,
      projectsResponse,
    ] = await Promise.all([
      SELF.fetch("http://soundkit.test/v1/discover/home"),
      SELF.fetch("http://soundkit.test/v1/tracks"),
      SELF.fetch("http://soundkit.test/v1/videos"),
      SELF.fetch("http://soundkit.test/v1/battles"),
      SELF.fetch(
        "http://soundkit.test/v1/projects/public?regionType=north-america&region=us-arkansas&type=ep"
      ),
    ]);

    expect(discoverResponse.status).toBe(200);
    expect(tracksResponse.status).toBe(200);
    expect(videosResponse.status).toBe(200);
    expect(battlesResponse.status).toBe(200);
    expect(projectsResponse.status).toBe(200);

    const tracks = await readJson<unknown[]>(tracksResponse);
    const videos = await readJson<unknown[]>(videosResponse);
    const battles = await readJson<unknown[]>(battlesResponse);
    const projects =
      await readJson<
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

  it("filters public projects by sale state in no-storage mode", async () => {
    const response = await SELF.fetch(
      "http://soundkit.test/v1/projects/public?forSale=true"
    );
    const projects = await readJson<unknown[]>(response);

    expect(response.status).toBe(200);
    expect(projects).toEqual([]);
  });

  it("reports live room state as unavailable without a Durable Object binding", async () => {
    const partyResponse = await SELF.fetch(
      "http://soundkit.test/v1/live/rooms/single-album-party"
    );
    const battleResponse = await SELF.fetch(
      "http://soundkit.test/v1/live/rooms/battle-1"
    );
    const party = await readJson<{ message: string }>(partyResponse);
    const battle = await readJson<{ message: string }>(battleResponse);

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
    );
    const cartResponse = await SELF.fetch("http://soundkit.test/v1/cart");
    const friendsResponse = await SELF.fetch(
      "http://soundkit.test/v1/messages/friends"
    );
    const conversationsResponse = await SELF.fetch(
      "http://soundkit.test/v1/messages/conversations"
    );
    const conversationMessagesResponse = await SELF.fetch(
      "http://soundkit.test/v1/messages/conversations/conv_sarah/messages"
    );
    const checkoutResponse = await SELF.fetch(
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
    const statusResponse = await SELF.fetch("http://soundkit.test/v1/uploads");
    const uploadResponse = await SELF.fetch(
      "http://soundkit.test/v1/uploads/track-source",
      {
        method: "POST",
      }
    );
    const statusBody = await readJson<{ message: string }>(statusResponse);
    const uploadBody = await readJson<{ message: string }>(uploadResponse);

    expect(statusResponse.status).toBe(200);
    expect(statusBody.message).toContain("UPLOAD_BUCKET_NAME");
    expect(uploadResponse.status).toBe(503);
    expect(uploadBody.message).toContain("not configured");
  });

  it("exposes the full genre catalog even when the database is not configured", async () => {
    const response = await SELF.fetch(
      "http://soundkit.test/v1/discover/genres"
    );
    const body = await readJson<{ name: string; slug: string }[]>(response);

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
    );
    const body = await readJson<{ message: string }>(response);

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
    );
    const body = await readJson<unknown>(response);

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
