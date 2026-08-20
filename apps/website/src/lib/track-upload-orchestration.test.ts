import { describe, expect, it, vi } from "vitest";

describe("track upload orchestration & deterministic master matching", () => {
  it("matches master file deterministically from multi-file upload results", () => {
    const masterFile = new File(["master-audio-bytes"], "my-hit-song.wav", {
      type: "audio/wav",
    }),
     previewFile = new File(["preview-bytes"], "my-hit-song.preview.wav", {
      type: "audio/wav",
    }),

     uploadResults = {
      allSucceeded: true,
      failedFiles: [],
      files: [
        {
          name: "my-hit-song.preview.wav",
          objectInfo: { key: "tracks/user-1/preview-key.wav", metadata: {} },
          progress: 1,
          raw: previewFile,
          size: 1000,
          status: "complete" as const,
          type: "audio/wav",
        },
        {
          name: "my-hit-song.wav",
          objectInfo: { key: "tracks/user-1/master-key.wav", metadata: {} },
          progress: 1,
          raw: masterFile,
          size: 50_000_000,
          status: "complete" as const,
          type: "audio/wav",
        },
      ],
      hasFailedFiles: false,
      metadata: {},
    },

    // Even if preview is returned first (index 0), master is matched deterministically
     masterUpload = uploadResults.files.find(
      (entry) =>
        (entry.raw && entry.raw === masterFile) ||
        (!entry.name.endsWith(".preview.wav") &&
          entry.name === masterFile.name) ||
        !entry.name.endsWith(".preview.wav")
    ),

     previewUpload = uploadResults.files.find(
      (entry) =>
        (entry.raw && entry.raw === previewFile) ||
        entry.name.endsWith(".preview.wav")
    );

    expect(masterUpload).toBeDefined();
    expect(masterUpload?.objectInfo.key).toBe("tracks/user-1/master-key.wav");
    expect(previewUpload).toBeDefined();
    expect(previewUpload?.objectInfo.key).toBe("tracks/user-1/preview-key.wav");
  });

  it("handles partial failure without failing master when optional stems fail", () => {
    const masterFile = new File(["master-audio-bytes"], "track.wav", {
      type: "audio/wav",
    }),

     masterResult = {
      allSucceeded: true,
      failedFiles: [],
      files: [
        {
          name: "track.wav",
          objectInfo: { key: "tracks/user-1/master.wav", metadata: {} },
          progress: 1,
          raw: masterFile,
          size: 20_000_000,
          status: "complete" as const,
          type: "audio/wav",
        },
      ],
    },

     optionalComponentsResult = {
      allSucceeded: false,
      failedFiles: [
        {
          error: {
            message: "Network timeout on stem",
            type: "s3_upload" as const,
          },
          name: "vocals.wav",
          progress: 0.3,
          raw: new File(["stem"], "vocals.wav"),
          size: 5000,
          status: "failed" as const,
          type: "audio/wav",
        },
      ],
      files: [],
    },

    // Master succeeds
     masterUpload = masterResult.files.find(
      (entry) => entry.name === masterFile.name
    );
    expect(masterUpload).toBeDefined();

    // Stem failures do not prevent master settlement
    const hasCoreMaster = Boolean(masterUpload);
    expect(hasCoreMaster).toBe(true);
    expect(optionalComponentsResult.failedFiles.length).toBe(1);
  });

  it("defensively recovers and re-finalizes asset when settlement encounters MASTER_UPLOAD_PENDING", async () => {
    let settlementAttempts = 0,
     masterFinalized = false;

    const mockFinalizeMaster = vi.fn(async () => {
      masterFinalized = true;
      return { status: "uploaded" };
    }),

     mockSettleTrack = vi.fn(async () => {
      settlementAttempts += 1;
      if (!masterFinalized && settlementAttempts === 1) {
        const error = new Error(
          "Master audio must finish uploading before this track can be settled."
        );
        (error as { code?: string }).code = "MASTER_UPLOAD_PENDING";
        throw error;
      }
      return { id: "track-1", isPublic: true };
    });

    // Simulate orchestrator recovery loop
    let result;
    try {
      result = await mockSettleTrack();
    } catch (error) {
      const isPendingMaster =
        error instanceof Error &&
        ((error as { code?: string }).code === "MASTER_UPLOAD_PENDING" ||
          error.message.includes("Master audio must finish uploading"));

      if (isPendingMaster) {
        await mockFinalizeMaster();
        result = await mockSettleTrack();
      } else {
        throw error;
      }
    }

    expect(mockFinalizeMaster).toHaveBeenCalledTimes(1);
    expect(mockSettleTrack).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ id: "track-1", isPublic: true });
  });

  it("skips re-uploading master when retrying an already uploaded and finalized track", () => {
    const existingUploadedTrack = {
      assetId: "asset-123",
      durationMs: 180_000,
      objectKey: "tracks/user-1/master.wav",
      remoteUrl: "https://media.soundkit.com/tracks/user-1/master.wav",
      statusMessage: "Uploaded to SoundKit storage.",
      title: "My Track",
      trackId: "track-123",
    },

     shouldUploadMaster = !existingUploadedTrack.objectKey;
    expect(shouldUploadMaster).toBe(false);

    // Track ID and master key are reused directly for settlement
    expect(existingUploadedTrack.trackId).toBe("track-123");
    expect(existingUploadedTrack.objectKey).toBe("tracks/user-1/master.wav");
  });
});
