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

  it("returns fallback discovery and catalog read models when storage is not configured", async () => {
    const [discoverResponse, tracksResponse, videosResponse, battlesResponse] =
      await Promise.all([
        SELF.fetch("http://soundkit.test/v1/discover/home"),
        SELF.fetch("http://soundkit.test/v1/tracks"),
        SELF.fetch("http://soundkit.test/v1/videos"),
        SELF.fetch("http://soundkit.test/v1/battles"),
      ]);

    expect(discoverResponse.status).toBe(200);
    expect(tracksResponse.status).toBe(200);
    expect(videosResponse.status).toBe(200);
    expect(battlesResponse.status).toBe(200);

    const tracks = await readJson<unknown[]>(tracksResponse);
    const videos = await readJson<unknown[]>(videosResponse);
    const battles = await readJson<unknown[]>(battlesResponse);

    expect(tracks.length).toBeGreaterThan(0);
    expect(videos.length).toBeGreaterThan(0);
    expect(battles.length).toBeGreaterThan(0);
  });

  it("serves live room state with chat, lyrics, and battle voting metadata", async () => {
    const partyResponse = await SELF.fetch(
      "http://soundkit.test/v1/live/rooms/single-album-party"
    );
    const battleResponse = await SELF.fetch(
      "http://soundkit.test/v1/live/rooms/battle-1"
    );
    const party = await readJson<{
      chat: unknown[];
      currentTrackId: string;
      kind: string;
      tracklist: { lyrics: unknown[]; status: string }[];
    }>(partyResponse);
    const battle = await readJson<{
      battle: {
        artists: { isMuted: boolean; name: string }[];
        rounds: {
          status: string;
          voteTotals: Record<string, number>;
        }[];
        tiePolicy: string;
      };
      kind: string;
    }>(battleResponse);

    expect(partyResponse.status).toBe(200);
    expect(party.kind).toBe("party");
    expect(party.currentTrackId).toBeTruthy();
    expect(party.chat.length).toBeGreaterThan(0);
    expect(party.tracklist.some((track) => track.lyrics.length > 0)).toBe(true);
    expect(battleResponse.status).toBe(200);
    expect(battle.kind).toBe("battle");
    expect(battle.battle.artists.some((artist) => artist.isMuted)).toBe(true);
    expect(
      battle.battle.rounds.some((round) => round.status === "voting")
    ).toBe(true);
    expect(battle.battle.tiePolicy).toContain("tiebreaker");
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
    const checkoutResponse = await SELF.fetch(
      "http://soundkit.test/v1/billing/checkout",
      jsonRequest("POST", {
        cancelUrl: "http://127.0.0.1:3001/pricing",
        planCode: "artist_lite_ads",
        successUrl: "http://127.0.0.1:3001/dashboard",
      })
    );

    expect(createTrackResponse.status).toBe(401);
    expect(cartResponse.status).toBe(401);
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
