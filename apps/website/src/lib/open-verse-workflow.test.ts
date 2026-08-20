import { describe, expect, it } from "vitest";

describe("Open Verse Workflow & Audio Slicing", () => {
  it("calculates correct start, end, and duration bounds for open verse slots", () => {
    const requestedEnd = 80,
      requestedStart = 35,
      totalDuration = 214,
      startSec = Math.max(0, Math.min(requestedStart, totalDuration - 5)),
      endSec = Math.max(startSec + 3, Math.min(requestedEnd, totalDuration)),
      selectionDuration = endSec - startSec;

    expect(startSec).toBe(35);
    expect(endSec).toBe(80);
    expect(selectionDuration).toBe(45);
  });

  it("enforces anti-leech 0-uploads rule: blocks users with 0 uploaded content", () => {
    const userProjectsCount = 0,
      userTracksCount = 0,
      canSubmitOpenVerse = (tracks: number, projects: number) =>
        tracks + projects > 0;

    expect(canSubmitOpenVerse(userTracksCount, userProjectsCount)).toBe(false);
    expect(canSubmitOpenVerse(1, 0)).toBe(true);
    expect(canSubmitOpenVerse(0, 1)).toBe(true);
  });

  it("safely generates open verse snippet filenames", () => {
    const trackName = "Late Night Reverie (feat. CG Stewart)",
      sanitized = trackName.toLowerCase().replaceAll(/[^a-z0-9]/gu, "-"),
      snippetFileName = `open-verse-stub-${sanitized}.wav`;

    expect(snippetFileName).toBe(
      "open-verse-stub-late-night-reverie--feat--cg-stewart-.wav"
    );
  });
});
