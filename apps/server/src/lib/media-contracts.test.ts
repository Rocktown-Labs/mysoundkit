import { describe, expect, it } from "vitest";

import {
  battleEligibilityBodySchema,
  createLyricsRevisionBodySchema,
  directVideoUploadBodySchema,
} from "./schemas";

describe("media workflow contracts", () => {
  it("accepts synchronized lyric revisions and defaults their language", () => {
    const lyrics = createLyricsRevisionBodySchema.parse({
      text: "Opening line",
      timedLines: [{ endMs: 1800, startMs: 500, text: "Opening line" }],
    });

    expect(lyrics.language).toBe("en");
    expect(lyrics.timedLines?.[0]).toMatchObject({
      endMs: 1800,
      startMs: 500,
    });
  });

  it("rejects lyric cue lines with invalid timing", () => {
    const result = createLyricsRevisionBodySchema.safeParse({
      text: "Opening line",
      timedLines: [{ endMs: 500, startMs: 500, text: "Opening line" }],
    });

    expect(result.success).toBe(false);
  });

  it("allows standalone categorized Mux uploads with public playback", () => {
    const upload = directVideoUploadBodySchema.parse({
      title: "Battle Night Recap",
      videoKind: "battle_replay",
    });

    expect(upload.playbackPolicy).toBe("public");
    expect(upload.sourceTrackId).toBeUndefined();
    expect(upload.videoKind).toBe("battle_replay");
  });

  it("does not advertise signed direct uploads before playback tokens exist", () => {
    const result = directVideoUploadBodySchema.safeParse({
      playbackPolicy: "signed",
      title: "Gated Video",
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one track for battle eligibility checks", () => {
    expect(
      battleEligibilityBodySchema.safeParse({ trackIds: [] }).success
    ).toBe(false);
  });
});
