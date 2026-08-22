/* eslint-disable require-await, sort-vars */
import { describe, expect, it, vi } from "vitest";

describe("track upload orchestration", () => {
  it("uploads only the original master with track-scoped metadata", async () => {
    const masterFile = new File(["master-audio-bytes"], "my-hit-song.wav", {
        type: "audio/wav",
      }),
      uploadAsync = vi.fn(async (files: File[], options: unknown) => ({
        failedFiles: [],
        files: [
          {
            name: files[0]?.name,
            objectInfo: {
              key: "tracks/user-1/track-1/source/master-key.wav",
            },
            raw: files[0],
          },
        ],
        options,
      })),
      result = await uploadAsync([masterFile], {
        metadata: { trackId: "track-1" },
      });

    expect(uploadAsync).toHaveBeenCalledWith([masterFile], {
      metadata: { trackId: "track-1" },
    });
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.name).not.toContain("preview");
    expect(result.files[0]?.objectInfo.key).toContain("/track-1/source/");
  });

  it("finalizes uploaded assets and settlement through one request", () => {
    const request = {
      assets: [
        {
          assetKind: "cover_art" as const,
          objectKey: "uploads/user-1/cover.jpg",
          status: "ready" as const,
          storageProvider: "r2" as const,
        },
        {
          assetKind: "master" as const,
          objectKey: "tracks/user-1/track-1/source/master.wav",
          sizeBytes: 27_500_000,
          status: "uploaded" as const,
          storageProvider: "r2" as const,
        },
      ],
      settlement: {
        isPublic: true,
        productionStatus: "complete" as const,
        releaseStrategy: "publish_when_ready" as const,
        requireCoverArt: true,
      },
    };

    expect(request.assets.map((asset) => asset.assetKind)).toEqual([
      "cover_art",
      "master",
    ]);
    expect(request.settlement.releaseStrategy).toBe("publish_when_ready");
  });

  it("retries finalization without uploading the master again", async () => {
    const uploadMaster = vi.fn(async () => ({
        objectKey: "tracks/user-1/track-1/source/master.wav",
      })),
      finalizeUpload = vi
        .fn()
        .mockRejectedValueOnce(new Error("Finalization request interrupted."))
        .mockResolvedValueOnce({ id: "track-1" }),
      uploaded = await uploadMaster();

    await expect(finalizeUpload(uploaded)).rejects.toThrow("interrupted");
    await expect(finalizeUpload(uploaded)).resolves.toEqual({ id: "track-1" });

    expect(uploadMaster).toHaveBeenCalledTimes(1);
    expect(finalizeUpload).toHaveBeenCalledTimes(2);
  });
});
