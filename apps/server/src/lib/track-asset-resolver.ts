/* eslint-disable one-var, sort-vars */
import { createDb } from "@soundkit/db";
import { trackAssets } from "@soundkit/db/schema/app";
import { and, desc, eq } from "drizzle-orm";

import { logWarn } from "@/middleware/structured-logging";

import type { MediaAssetPurpose } from "./media-pipeline";

export type TrackAssetResolutionPurpose =
  | "battle"
  | "consumer_download"
  | "lossless_download"
  | "master"
  | "open_verse_snippet"
  | "streaming";

const semanticPurpose = (
    purpose: TrackAssetResolutionPurpose
  ): MediaAssetPurpose => {
    if (purpose === "consumer_download") {
      return "download";
    }
    // Battle playback intentionally reuses the canonical streaming asset.
    return purpose === "battle" ? "streaming" : purpose;
  },
  isReadyCurrentAsset = (asset: typeof trackAssets.$inferSelect) =>
    asset.isCurrent && asset.status === "ready" && Boolean(asset.objectKey),
  legacyAssetKinds = (purpose: TrackAssetResolutionPurpose): string[] => {
    if (purpose === "consumer_download") {
      return ["tagged_mp3"];
    }
    if (purpose === "battle" || purpose === "streaming") {
      return ["master", "untagged_wav", "tagged_mp3"];
    }
    return [];
  },
  legacyAssetForPurpose = ({
    assets,
    purpose,
  }: {
    assets: (typeof trackAssets.$inferSelect)[];
    purpose: TrackAssetResolutionPurpose;
  }) => {
    const legacyKinds = legacyAssetKinds(purpose);
    return assets.find(
      (asset) =>
        legacyKinds.includes(asset.assetKind) &&
        asset.processingVersion === null &&
        isReadyCurrentAsset(asset)
    );
  };

export const resolveTrackCoverAssetFromRows = (
  assets: (typeof trackAssets.$inferSelect)[]
): typeof trackAssets.$inferSelect | null =>
  assets.find(
    (asset) =>
      asset.assetKind === "cover_art" &&
      asset.isCurrent &&
      asset.status === "ready" &&
      Boolean(asset.objectKey)
  ) ??
  assets.find((asset) => asset.assetKind === "cover_art" && asset.isCurrent) ??
  null;

export const resolveTrackAssetFromRows = ({
  allowLegacyFallback = false,
  assets,
  purpose,
  trackId,
}: {
  allowLegacyFallback?: boolean;
  assets: (typeof trackAssets.$inferSelect)[];
  purpose: TrackAssetResolutionPurpose;
  trackId: string;
}): typeof trackAssets.$inferSelect | null => {
  if (purpose === "master") {
    return (
      assets.find(
        (asset) =>
          asset.assetKind === "master" &&
          asset.isCurrent &&
          (asset.status === "ready" || asset.status === "uploaded") &&
          Boolean(asset.objectKey)
      ) ?? null
    );
  }

  const expectedPurpose = semanticPurpose(purpose),
    currentMaster = assets.find(
      (asset) => asset.assetKind === "master" && asset.isCurrent
    ),
    derivative = assets.find(
      (asset) =>
        asset.purpose === expectedPurpose &&
        asset.sourceAssetId === currentMaster?.id &&
        isReadyCurrentAsset(asset)
    );
  if (derivative) {
    return derivative;
  }

  if (!allowLegacyFallback) {
    return null;
  }

  const fallback = legacyAssetForPurpose({ assets, purpose });
  if (fallback) {
    logWarn({
      assetId: fallback.id,
      event: "media_pipeline_fallback_used",
      purpose,
      trackId,
    });
  }
  return fallback ?? null;
};

export const resolveTrackAsset = async ({
  allowLegacyFallback = false,
  purpose,
  trackId,
}: {
  allowLegacyFallback?: boolean;
  purpose: TrackAssetResolutionPurpose;
  trackId: string;
}): Promise<typeof trackAssets.$inferSelect | null> => {
  const assets = await createDb()
    .select()
    .from(trackAssets)
    .where(
      and(eq(trackAssets.trackId, trackId), eq(trackAssets.isCurrent, true))
    )
    .orderBy(desc(trackAssets.updatedAt));
  return resolveTrackAssetFromRows({
    allowLegacyFallback,
    assets,
    purpose,
    trackId,
  });
};
