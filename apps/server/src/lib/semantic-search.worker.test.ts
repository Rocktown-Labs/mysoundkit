/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { describe, expect, it } from "vitest";

import {
  buildTrackIndexText,
  chunkLyricSections,
  rollupSemanticMatches,
} from "./semantic-search";

describe("chunkLyricSections", () => {
  it("returns no chunks for blank input", () => {
    expect(chunkLyricSections("   \n  ")).toEqual([]);
  });

  it("splits on section headers", () => {
    const chunks = chunkLyricSections(
      "[Verse 1]\nWalking down the empty road\n\n[Chorus]\nSummer love, windows down"
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ section: "Verse 1" });
    expect(chunks[1]).toMatchObject({ section: "Chorus" });
  });

  it("splits on blank lines without headers", () => {
    const chunks = chunkLyricSections(
      "First stanza here\n\nSecond stanza here"
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.section).toBeNull();
  });

  it("merges tiny fragments into neighbors", () => {
    const chunks = chunkLyricSections(
      "Yeah\n\nA much longer second stanza with real content here"
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toContain("Yeah");
  });

  it("hard-splits oversized sections and caps total chunks", () => {
    const longSection = Array.from(
      { length: 60 },
      (_, index) => `Line number ${index} with enough words to add weight`
    ).join("\n"),
     chunks = chunkLyricSections(longSection);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThanOrEqual(32);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(1600);
    }
  });
});

describe("buildTrackIndexText", () => {
  it("labels fields with title always present", () => {
    const text = buildTrackIndexText({
      artistName: "Nova Reign",
      bpm: 140,
      description: "A dark phonk anthem.",
      genreName: "Phonk",
      musicalKey: "F# min",
      title: "Midnight Run",
    });
    expect(text).toContain("Title: Midnight Run");
    expect(text).toContain("Artist: Nova Reign");
    expect(text).toContain("Genre: Phonk");
    expect(text).toContain("Tempo: 140 BPM");
    expect(text).toContain("Key: F# min");
  });

  it("omits missing fields", () => {
    const text = buildTrackIndexText({ title: "Untitled" });
    expect(text).toBe("Title: Untitled");
  });
});

describe("rollupSemanticMatches", () => {
  it("rolls lyric chunks up to their song by best distance", () => {
    const rolled = rollupSemanticMatches(
      [
        {
          distance: 0.5,
          entityId: "lyrics-1#0",
          entityType: "lyrics",
          metadata: { trackId: "track-a" },
          textSnapshot: "verse about rain",
        },
        {
          distance: 0.2,
          entityId: "lyrics-1#1",
          entityType: "lyrics",
          metadata: { trackId: "track-a" },
          textSnapshot: "chorus about summer love and the ocean breeze",
        },
        {
          distance: 0.4,
          entityId: "track-b",
          entityType: "track",
          metadata: null,
          textSnapshot: "Title: Other",
        },
      ],
      10
    );
    expect(rolled).toHaveLength(2);
    expect(rolled[0]).toMatchObject({
      distance: 0.2,
      entityId: "track-a",
      entityType: "track",
      matchedVia: "lyrics",
    });
    expect(rolled[0]?.snippet).toContain("summer love");
    expect(rolled[1]).toMatchObject({
      entityId: "track-b",
      matchedVia: "metadata",
    });
  });

  it("drops lyric rows without a track mapping", () => {
    const rolled = rollupSemanticMatches(
      [
        {
          distance: 0.1,
          entityId: "orphan",
          entityType: "lyrics",
          metadata: null,
          textSnapshot: "lost words",
        },
      ],
      10
    );
    expect(rolled).toHaveLength(0);
  });

  it("dedupes direct hits keeping the best distance and sorts", () => {
    const rolled = rollupSemanticMatches(
      [
        {
          distance: 0.6,
          entityId: "t1",
          entityType: "track",
          metadata: null,
          textSnapshot: "x",
        },
        {
          distance: 0.3,
          entityId: "t1",
          entityType: "track",
          metadata: null,
          textSnapshot: "x",
        },
        {
          distance: 0.5,
          entityId: "t2",
          entityType: "track",
          metadata: null,
          textSnapshot: "x",
        },
      ],
      10
    );
    expect(rolled.map((match) => match.entityId)).toEqual(["t1", "t2"]);
    expect(rolled[0]?.distance).toBe(0.3);
  });
});
