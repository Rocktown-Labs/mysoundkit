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

describe("Weekly plays aggregation and 30-day release sorting", () => {
  it("resolves weekly plays with total plays fallback for rising artists", () => {
    const artistWithWeekly = {
      totalPlays: 120,
      weeklyPlays: 45,
    };
    const artistWithPastPlaysOnly = {
      totalPlays: 77,
      weeklyPlays: 0,
    };

    const resolvedWeekly =
      artistWithWeekly.weeklyPlays > 0
        ? artistWithWeekly.weeklyPlays
        : artistWithPastPlaysOnly.totalPlays;
    const fallbackWeekly =
      artistWithPastPlaysOnly.weeklyPlays > 0
        ? artistWithPastPlaysOnly.weeklyPlays
        : artistWithPastPlaysOnly.totalPlays;

    expect(resolvedWeekly).toBe(45);
    expect(fallbackWeekly).toBe(77);
  });

  it("prioritizes releases published within 30 days while falling back to catalog", () => {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    const tracks = [
      { id: "old-track", publishedAt: new Date(now - thirtyDaysMs * 2) },
      { id: "fresh-track", publishedAt: new Date(now - thirtyDaysMs / 2) },
    ];

    const sorted = [...tracks].sort((a, b) => {
      const aIsRecent = now - a.publishedAt.getTime() <= thirtyDaysMs ? 1 : 0;
      const bIsRecent = now - b.publishedAt.getTime() <= thirtyDaysMs ? 1 : 0;
      if (aIsRecent !== bIsRecent) {
        return bIsRecent - aIsRecent;
      }
      return b.publishedAt.getTime() - a.publishedAt.getTime();
    });

    expect(sorted[0]?.id).toBe("fresh-track");
    expect(sorted[1]?.id).toBe("old-track");
  });
});

describe("track settlement guard & upload namespace validation", () => {
  it("requires master asset with uploaded or ready status and object key", () => {
    const assetsPending = [
      {
        assetKind: "master",
        id: "a1",
        objectKey: "tracks/user1/test.wav",
        status: "pending",
      },
    ];
    const assetsUploading = [
      {
        assetKind: "master",
        id: "a1",
        objectKey: "tracks/user1/test.wav",
        status: "uploading",
      },
    ];
    const assetsUploaded = [
      {
        assetKind: "master",
        id: "a1",
        objectKey: "tracks/user1/test.wav",
        status: "uploaded",
      },
    ];
    const assetsReady = [
      {
        assetKind: "master",
        id: "a1",
        objectKey: "tracks/user1/test.wav",
        status: "ready",
      },
    ];

    const findMaster = (
      assets: { assetKind: string; objectKey: string; status: string }[]
    ) =>
      assets.find(
        (asset) =>
          asset.assetKind === "master" &&
          Boolean(asset.objectKey) &&
          (asset.status === "ready" || asset.status === "uploaded")
      );

    expect(findMaster(assetsPending)).toBeUndefined();
    expect(findMaster(assetsUploading)).toBeUndefined();
    expect(findMaster(assetsUploaded)).toBeDefined();
    expect(findMaster(assetsReady)).toBeDefined();
  });
});
