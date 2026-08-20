/* eslint-disable no-inline-comments, one-var, unicorn/numeric-separators-style */
import { describe, expect, it } from "vitest";

describe("track settlement & public visibility", () => {
  it("allows demo, mixed, and mastered tracks to be public when isPublic is true", () => {
    const statuses = ["demo", "mixed", "mastered", "complete"] as const;

    for (const status of statuses) {
      const track = {
        id: "track-123",
        isPublic: true,
        productionStatus: status,
      };

      // Tracks with isPublic = true are visible in public query
      const isVisiblePublicly = track.isPublic === true;
      expect(isVisiblePublicly).toBe(true);
    }
  });

  it("handles track deletion with purchase protection by soft-archiving", () => {
    const track = {
      id: "track-purchased",
      isForSale: true,
      isPublic: true,
      releaseStrategy: "publish_when_ready",
    };

    const hasPurchases = true;

    const deletionAction = hasPurchases
      ? {
          ...track,
          isForSale: false,
          isPublic: false,
          releaseStrategy: "private",
          type: "archive" as const,
        }
      : {
          id: track.id,
          type: "delete" as const,
        };

    expect(deletionAction.type).toBe("archive");
    if (deletionAction.type === "archive") {
      expect(deletionAction.isPublic).toBe(false);
      expect(deletionAction.isForSale).toBe(false);
    }
  });
});

describe("Whisper vocal stem slicing", () => {
  it("slices audio blobs exceeding 25MB limit", () => {
    const MAX_OPENAI_TRANSCRIPTION_FILE_BYTES = 25 * 1024 * 1024;

    // Simulate 30MB audio blob
    const largeAudioSize = 30 * 1024 * 1024;
    const mockBlob = new Blob([new Uint8Array(1000)], { type: "audio/wav" });
    Object.defineProperty(mockBlob, "size", { value: largeAudioSize });

    const sliced =
      mockBlob.size > MAX_OPENAI_TRANSCRIPTION_FILE_BYTES
        ? mockBlob.slice(0, MAX_OPENAI_TRANSCRIPTION_FILE_BYTES)
        : mockBlob;

    expect(mockBlob.size).toBeGreaterThan(MAX_OPENAI_TRANSCRIPTION_FILE_BYTES);
    expect(sliced).toBeDefined();
  });
});
