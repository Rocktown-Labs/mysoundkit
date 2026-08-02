/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { describe, expect, it } from "vitest";

import { buildTimedLyricLinesFromWords } from "./audio-processing";

describe("audio processing transcription helpers", () => {
  it("groups OpenAI word timestamps into timed lyric lines", () => {
    const lines = buildTimedLyricLinesFromWords([
      { end: 0.35, start: 0.1, word: "Late" },
      { end: 0.65, start: 0.36, word: "night" },
      { end: 0.95, start: 0.66, word: "drive" },
      { end: 2.8, start: 2.3, word: "City" },
      { end: 3.2, start: 2.85, word: "lights" },
    ]);

    expect(lines).toEqual([
      { endMs: 950, startMs: 100, text: "Late night drive" },
      { endMs: 3200, startMs: 2300, text: "City lights" },
    ]);
  });

  it("ignores malformed timestamp words", () => {
    const lines = buildTimedLyricLinesFromWords([
      { end: 0.25, start: 0, word: "Valid" },
      { end: 0.5, word: "missing-start" },
      { start: 0.55, word: "missing-end" },
      { end: 0.9, start: 0.65, word: "line" },
    ]);

    expect(lines).toEqual([{ endMs: 900, startMs: 0, text: "Valid line" }]);
  });
});
