/* eslint-disable sort-vars */
import type { trackAssets } from "@soundkit/db/schema/app";
import { describe, expect, it } from "vitest";

import { resolveTrackAssetFromRows } from "./track-asset-resolver";

type TrackAsset = typeof trackAssets.$inferSelect;

const asset = (
  overrides: Partial<TrackAsset> & Pick<TrackAsset, "assetKind" | "id">
): TrackAsset => {
  const { assetKind, id, ...rest } = overrides;
  return {
    assetKind,
    bucketName: null,
    checksum: null,
    createdAt: new Date("2026-08-21T00:00:00Z"),
    durationMs: 180_000,
    id,
    integratedLufs: null,
    isCurrent: true,
    metadata: null,
    mimeType: "audio/wav",
    normalizationTargetLufs: null,
    objectKey: `tracks/user/${overrides.id}`,
    processingVersion: null,
    purpose: null,
    sizeBytes: 1024,
    sourceAssetId: null,
    status: "ready",
    storageProvider: "r2",
    trackId: "track-1",
    trackVariantId: null,
    truePeakDbtp: null,
    updatedAt: new Date("2026-08-21T00:00:00Z"),
    uploaderUserId: "user-1",
    ...rest,
  };
};

describe("central track asset resolver", () => {
  it("does not expose a V2 master while streaming is processing", () => {
    const master = asset({
      assetKind: "master",
      id: "master-v2",
      processingVersion: 1,
      purpose: "master",
    });

    expect(
      resolveTrackAssetFromRows({
        allowLegacyFallback: true,
        assets: [master],
        purpose: "streaming",
        trackId: "track-1",
      })
    ).toBeNull();
  });

  it("selects a ready derivative from the current master lineage", () => {
    const master = asset({
        assetKind: "master",
        id: "master-current",
        processingVersion: 1,
        purpose: "master",
      }),
      streaming = asset({
        assetKind: "variant_audio",
        id: "streaming-current",
        mimeType: "audio/mp4",
        processingVersion: 1,
        purpose: "streaming",
        sourceAssetId: master.id,
      }),
      staleStreaming = asset({
        assetKind: "variant_audio",
        id: "streaming-stale",
        isCurrent: false,
        processingVersion: 1,
        purpose: "streaming",
        sourceAssetId: "master-old",
      });

    expect(
      resolveTrackAssetFromRows({
        allowLegacyFallback: true,
        assets: [master, staleStreaming, streaming],
        purpose: "streaming",
        trackId: "track-1",
      })?.id
    ).toBe("streaming-current");
  });

  it("reuses the canonical streaming derivative for battle playback", () => {
    const master = asset({
        assetKind: "master",
        id: "master-current",
        processingVersion: 2,
        purpose: "master",
      }),
      streaming = asset({
        assetKind: "variant_audio",
        id: "streaming-current",
        mimeType: "audio/mp4",
        normalizationTargetLufs: "-13.00",
        processingVersion: 2,
        purpose: "streaming",
        sourceAssetId: master.id,
      });

    expect(
      resolveTrackAssetFromRows({
        assets: [master, streaming],
        purpose: "battle",
        trackId: "track-1",
      })?.id
    ).toBe("streaming-current");
  });

  it("uses an observable master fallback only for legacy sources", () => {
    const legacyMaster = asset({ assetKind: "master", id: "legacy-master" });

    expect(
      resolveTrackAssetFromRows({
        allowLegacyFallback: true,
        assets: [legacyMaster],
        purpose: "streaming",
        trackId: "track-1",
      })?.id
    ).toBe("legacy-master");
  });
});
