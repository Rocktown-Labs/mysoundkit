/* eslint-disable one-var, sort-vars */
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/u,
  SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]),
  missingThumbnailPaths = new Set(["", "/placeholder.svg"]),
  validYouTubeId = (value: null | string | undefined) => {
    const candidate = value?.trim() ?? "";
    return YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
  };

export const youtubeVideoIdFromUrl = (value: null | string | undefined) => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value),
      hostname = url.hostname.toLowerCase().replace(/^www\./u, ""),
      pathSegments = url.pathname.split("/").filter(Boolean);

    if (!SUPPORTED_PROTOCOLS.has(url.protocol)) {
      return null;
    }

    if (hostname === "youtu.be") {
      return validYouTubeId(pathSegments[0]);
    }

    const isYouTubeHost =
        hostname === "youtube.com" || hostname.endsWith(".youtube.com"),
      isPrivacyHost =
        hostname === "youtube-nocookie.com" ||
        hostname.endsWith(".youtube-nocookie.com");

    if (!(isYouTubeHost || isPrivacyHost)) {
      return null;
    }

    if (url.pathname === "/watch") {
      return validYouTubeId(url.searchParams.get("v"));
    }

    if (["embed", "live", "shorts"].includes(pathSegments[0] ?? "")) {
      return validYouTubeId(pathSegments[1]);
    }

    return null;
  } catch {
    return null;
  }
};

export const youtubeThumbnailUrl = (externalPlaybackUrl?: null | string) => {
  const videoId = youtubeVideoIdFromUrl(externalPlaybackUrl);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
};

export const resolveVideoThumbnailUrl = ({
  externalPlaybackUrl,
  muxPlaybackId,
  thumbnailUrl,
}: {
  externalPlaybackUrl?: null | string;
  muxPlaybackId?: null | string;
  thumbnailUrl?: null | string;
}) => {
  const explicitThumbnail = thumbnailUrl?.trim() ?? "";

  if (!missingThumbnailPaths.has(explicitThumbnail)) {
    return explicitThumbnail;
  }

  if (muxPlaybackId) {
    return `https://image.mux.com/${encodeURIComponent(muxPlaybackId)}/thumbnail.jpg`;
  }

  return youtubeThumbnailUrl(externalPlaybackUrl) ?? "/placeholder.svg";
};
