/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { describe, expect, it } from "vitest";

import {
  buildTimedLyricLinesFromSegments,
  buildTimedLyricLinesFromVtt,
  buildTimedLyricLinesFromWords,
} from "./audio-processing";

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

  it("flattens Workers AI segment words into timed lyric lines", () => {
    const lines = buildTimedLyricLinesFromSegments([
      {
        end: 1.2,
        start: 0.1,
        text: "Late night drive",
        words: [
          { end: 0.35, start: 0.1, word: "Late" },
          { end: 0.65, start: 0.36, word: "night" },
          { end: 1.2, start: 0.66, word: "drive" },
        ],
      },
      {
        end: 3.7,
        start: 2.8,
        text: "City lights",
        words: [
          { end: 3.3, start: 2.8, word: "City" },
          { end: 3.7, start: 3.35, word: "lights" },
        ],
      },
    ]);

    expect(lines).toEqual([
      { endMs: 1200, startMs: 100, text: "Late night drive" },
      { endMs: 3700, startMs: 2800, text: "City lights" },
    ]);
  });

  it("falls back to segment text when word timings are absent", () => {
    const lines = buildTimedLyricLinesFromSegments([
      { end: 2.0, start: 0.5, text: "Hello world" },
    ]);

    expect(lines).toEqual([{ endMs: 2000, startMs: 500, text: "Hello world" }]);
  });

  it("parses WebVTT cues into timed lyric lines", () => {
    const lines = buildTimedLyricLinesFromVtt(
      "WEBVTT\n\n00:00:00.100 --> 00:00:01.200\nLate night drive\n\n00:00:02.300 --> 00:00:03.200\nCity lights\n"
    );

    expect(lines).toEqual([
      { endMs: 1200, startMs: 100, text: "Late night drive" },
      { endMs: 3200, startMs: 2300, text: "City lights" },
    ]);
  });
});
