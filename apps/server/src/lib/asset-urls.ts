import type { projectAssets, trackAssets } from "@soundkit/db/schema/app";
import { env } from "@soundkit/env/server";
import type { InferSelectModel } from "drizzle-orm";

type TrackAssetLike = Pick<
  InferSelectModel<typeof trackAssets>,
  "metadata" | "objectKey"
>;

const mediaEnv = env as unknown as {
  BETTER_AUTH_URL?: string;
  MEDIA_PUBLIC_URL?: string;
  VITE_MEDIA_URL?: string;
};

export const formatDuration = (durationMs: number | null | undefined) => {
  if (!durationMs) {
    return "0:00";
  }

  const totalSeconds = Math.round(durationMs / 1000),
    minutes = Math.floor(totalSeconds / 60),
    seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const mediaBaseUrl = () =>
  (mediaEnv.MEDIA_PUBLIC_URL ?? mediaEnv.VITE_MEDIA_URL ?? "").replace(
    /\/+$/u,
    ""
  );

export const guardedTrackPlaybackUrl = (
  trackId: string,
  context: "battle" | "ordinary" = "ordinary"
) => {
  const apiBaseUrl = (mediaEnv.BETTER_AUTH_URL ?? "").replace(/\/+$/u, "");
  return apiBaseUrl
    ? `${apiBaseUrl}/v1/tracks/${encodeURIComponent(trackId)}/playback?context=${context}`
    : `/v1/tracks/${encodeURIComponent(trackId)}/playback?context=${context}`;
};

export const objectUrlFromMetadata = (metadata: unknown) => {
  if (!(metadata && typeof metadata === "object" && "url" in metadata)) {
    return null;
  }

  const { url } = metadata as { url?: unknown };
  return typeof url === "string" ? url : null;
};

export const publicAssetUrlFromParts = ({
  metadata,
  objectKey,
}: TrackAssetLike) => {
  const baseUrl = mediaBaseUrl();

  if (baseUrl && objectKey) {
    return `${baseUrl}/${objectKey}`;
  }

  return objectUrlFromMetadata(metadata);
};

export const publicAssetUrl = (asset: TrackAssetLike | undefined) =>
  asset ? publicAssetUrlFromParts(asset) : null;

export const publicProjectAssetUrl = (
  asset: InferSelectModel<typeof projectAssets> | undefined
) => {
  if (!asset) {
    return null;
  }

  const baseUrl = mediaBaseUrl();

  return baseUrl && asset.objectKey ? `${baseUrl}/${asset.objectKey}` : null;
};
