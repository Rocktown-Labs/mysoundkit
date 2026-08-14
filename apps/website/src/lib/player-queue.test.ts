import { describe, expect, it } from "vitest";

import type { PlayerTrack } from "../components/audio-player-provider";
import {
  completeQueuedTrack,
  shouldRestartCurrentTrack,
} from "./player-queue";

const track = (id: string): PlayerTrack => ({
  artist: `Artist ${id}`,
  id,
  src: `/audio/${id}.mp3`,
  title: `Track ${id}`,
});

describe("player queue", () => {
  it("removes the only completed track from the active queue", () => {
    const currentTrack = track("one");

    expect(
      completeQueuedTrack({ currentTrack, queue: [currentTrack], repeatMode: "off" })
    ).toEqual({ nextTrack: null, queue: [], restartCurrent: false });
  });

  it("advances to the next track and consumes the completed track", () => {
    const first = track("one");
    const second = track("two");

    expect(
      completeQueuedTrack({
        currentTrack: first,
        queue: [first, second],
        repeatMode: "off",
      })
    ).toEqual({ nextTrack: second, queue: [second], restartCurrent: false });
  });

  it("rotates completed tracks when repeat all is enabled", () => {
    const first = track("one");
    const second = track("two");

    expect(
      completeQueuedTrack({
        currentTrack: first,
        queue: [first, second],
        repeatMode: "all",
      })
    ).toEqual({
      nextTrack: second,
      queue: [second, first],
      restartCurrent: false,
    });
  });

  it("restarts a single current track when back is pressed", () => {
    expect(
      shouldRestartCurrentTrack({
        currentIndex: 0,
        currentTime: 0,
        queueLength: 1,
      })
    ).toBe(true);
  });
});
