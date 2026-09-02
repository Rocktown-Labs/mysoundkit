/// <reference types="@cloudflare/vitest-pool-workers/types" />

/* eslint-disable one-var, sort-vars */

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createSampleLiveRoom } from "../lib/live-room-data";
import type { LiveRoomDurableObject } from "./live-room";

describe("live stream review controls", () => {
  it("creates replaceable overlay tokens and exposes read-only stream state", async () => {
    const roomId = `live-review-${crypto.randomUUID()}`,
      liveRooms = (
        env as unknown as {
          LIVE_ROOMS: DurableObjectNamespace<LiveRoomDurableObject>;
        }
      ).LIVE_ROOMS,
      overlay = liveRooms.getByName(roomId),
      host = {
        displayName: "Review Host",
        role: "host" as const,
        userId: "review-host",
      };

    await overlay.seed(roomId, createSampleLiveRoom(roomId));

    const firstToken = await overlay.createStreamOverlayToken(roomId, host),
      secondToken = await overlay.createStreamOverlayToken(roomId, host);

    expect(await overlay.isValidStreamOverlayToken(firstToken.token)).toBe(
      false
    );
    expect(await overlay.isValidStreamOverlayToken(secondToken.token)).toBe(
      true
    );

    await overlay.setStreamBotEnabled(roomId, host, true);
    await overlay.setStreamNowPlaying(roomId, host, {
      artistName: "Review Artist",
      coverArtUrl: "",
      durationMs: 0,
      href: "/tracks/review-track",
      id: "review-track",
      lyrics: [],
      status: "playing",
      title: "Manual Review Cut",
    });

    const state = await overlay.getStreamOverlayState(
      roomId,
      secondToken.token
    );

    expect(state).not.toBeNull();
    expect(state?.stream?.botEnabled).toBe(true);
    expect(state?.stream?.nowPlaying?.title).toBe("Manual Review Cut");
    expect(state?.chat.at(-1)).toMatchObject({
      entity: {
        id: "review-track",
        title: "Manual Review Cut",
        type: "track",
      },
      message: "Now playing: “Manual Review Cut” by Review Artist",
      userId: "soundkit-streambot",
    });
  });
});
