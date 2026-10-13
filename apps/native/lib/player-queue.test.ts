/* eslint-disable one-var, sort-vars */
import { describe, expect, it } from "vitest";

import {
  advanceQueue,
  cycleRepeatMode,
  formatPlayerTime,
  formatRemainingTime,
  shuffleTracks,
} from "./player-queue";
import type { PlayerTrack } from "./player-queue";

const makeTrack = (id: string, title = `Track ${id}`): PlayerTrack => ({
  artist: "Test Artist",
  duration: 180,
  id,
  src: `https://soundkit.test/audio/${id}.mp3`,
  title,
});

describe("native player queue utilities", () => {
  it("formats player time accurately into MM:SS", () => {
    expect(formatPlayerTime(0)).toBe("0:00");
    expect(formatPlayerTime(9)).toBe("0:09");
    expect(formatPlayerTime(74)).toBe("1:14");
    expect(formatPlayerTime(233)).toBe("3:53");
    expect(formatPlayerTime(-5)).toBe("0:00");
    expect(formatPlayerTime(Number.NaN)).toBe("0:00");
  });

  it("formats remaining countdown time correctly", () => {
    expect(formatRemainingTime(169, 233)).toBe("-1:04");
    expect(formatRemainingTime(0, 180)).toBe("-3:00");
    expect(formatRemainingTime(180, 180)).toBe("-0:00");
    expect(formatRemainingTime(200, 180)).toBe("-0:00");
  });

  it("cycles repeat mode through off -> all -> one -> off", () => {
    expect(cycleRepeatMode("off")).toBe("all");
    expect(cycleRepeatMode("all")).toBe("one");
    expect(cycleRepeatMode("one")).toBe("off");
  });

  it("advances to the next track in queue when repeat is off", () => {
    const t1 = makeTrack("1");
    const t2 = makeTrack("2");
    const t3 = makeTrack("3");

    const result = advanceQueue({
      currentTrack: t1,
      queue: [t2, t3],
      repeatMode: "off",
    });

    expect(result.nextTrack).toBe(t2);
    expect(result.queue).toEqual([t3]);
    expect(result.restartCurrent).toBe(false);
  });

  it("stops playback when queue is exhausted and repeat is off", () => {
    const t1 = makeTrack("1");

    const result = advanceQueue({
      currentTrack: t1,
      queue: [],
      repeatMode: "off",
    });

    expect(result.nextTrack).toBeNull();
    expect(result.queue).toEqual([]);
    expect(result.restartCurrent).toBe(false);
  });

  it("restarts current track when repeatMode is 'one'", () => {
    const t1 = makeTrack("1");
    const t2 = makeTrack("2");

    const result = advanceQueue({
      currentTrack: t1,
      queue: [t2],
      repeatMode: "one",
    });

    expect(result.nextTrack).toBe(t1);
    expect(result.queue).toEqual([t2]);
    expect(result.restartCurrent).toBe(true);
  });

  it("rotates completed track to back of queue when repeatMode is 'all'", () => {
    const t1 = makeTrack("1");
    const t2 = makeTrack("2");

    const result = advanceQueue({
      currentTrack: t1,
      queue: [t2],
      repeatMode: "all",
    });

    expect(result.nextTrack).toBe(t2);
    expect(result.queue).toEqual([t1]);
    expect(result.restartCurrent).toBe(false);
  });

  it("shuffles queue containing multiple items without losing tracks", () => {
    const tracks = [
      makeTrack("1"),
      makeTrack("2"),
      makeTrack("3"),
      makeTrack("4"),
    ];
    const shuffled = shuffleTracks(tracks);

    expect(shuffled).toHaveLength(tracks.length);
    expect(shuffled.map((t) => t.id).toSorted()).toEqual(
      tracks.map((t) => t.id).toSorted()
    );
  });
});
