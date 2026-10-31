/* eslint-disable one-var, sort-vars */
import type { PlayerTrack } from "../components/audio-player-provider";

export interface PlayerVideoMetadata {
  externalPlaybackUrl?: string | null;
  muxPlaybackId?: string | null;
  verifiedOnPlatform: boolean;
  videoId: string;
}

const youtubeIdPattern = /^[A-Za-z0-9_-]{11}$/u;
const muxIdPattern = /^[A-Za-z0-9]+$/u;
const videoFilePattern = /\.(?:mp4|webm)(?:$)/iu;
const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export const getYouTubeVideoId = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    const [first, second] = segments;
    let id: string | null | undefined;
    if (url.hostname === "youtu.be") {
      id = first;
    } else if (youtubeHosts.has(url.hostname)) {
      if (url.pathname === "/watch") {
        id = url.searchParams.get("v");
      } else if (["embed", "shorts", "live"].includes(first ?? "")) {
        id = second;
      }
    }
    return id && youtubeIdPattern.test(id) ? id : null;
  } catch {
    return null;
  }
};

export const isDirectVideoUrl = (value: string): boolean => {
  try {
    const url = new URL(value, "https://mysoundkit.com");
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      videoFilePattern.test(url.pathname)
    );
  } catch {
    return false;
  }
};

export const isStoredVideoMetadata = (
  value: unknown
): value is PlayerVideoMetadata => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const video = value as Partial<PlayerVideoMetadata>;
  return (
    typeof video.videoId === "string" &&
    video.videoId.length > 0 &&
    typeof video.verifiedOnPlatform === "boolean" &&
    ((typeof video.muxPlaybackId === "string" &&
      muxIdPattern.test(video.muxPlaybackId)) ||
      (typeof video.externalPlaybackUrl === "string" &&
        (getYouTubeVideoId(video.externalPlaybackUrl) !== null ||
          isDirectVideoUrl(video.externalPlaybackUrl))))
  );
};

export const isVideoQueueItem = (
  item: PlayerTrack | null
): item is PlayerTrack & { mediaType: "video"; video: PlayerVideoMetadata } =>
  item?.mediaType === "video" && isStoredVideoMetadata(item.video);

export const videoQueueItem = (
  video: PlayerVideoMetadata & {
    artist: string;
    artistHref?: string | null;
    posterUrl: string;
    title: string;
    videoHref: string;
  }
): PlayerTrack | null => {
  if (!isStoredVideoMetadata(video)) {
    return null;
  }
  return {
    artist: video.artist,
    artistHref: video.artistHref,
    autoplay: true,
    cover: video.posterUrl,
    id: `video:${video.videoId}`,
    mediaType: "video",
    src: video.muxPlaybackId
      ? `https://stream.mux.com/${video.muxPlaybackId}.m3u8`
      : (video.externalPlaybackUrl ?? ""),
    title: video.title,
    trackHref: video.videoHref,
    video: {
      externalPlaybackUrl: video.externalPlaybackUrl,
      muxPlaybackId: video.muxPlaybackId,
      verifiedOnPlatform: video.verifiedOnPlatform,
      videoId: video.videoId,
    },
  };
};
