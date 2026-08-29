import { API_V1_URL } from "@/lib/api";

export interface TrackSeoData {
  artist: {
    handle: string;
    name: string;
  };
  coverArtUrl: string | null;
  description: string | null;
  durationMs: number | null;
  genre: string | null;
  id: string;
  playbackUrl: string | null;
  regionSlug: string | null;
  slug: string | null;
  title: string;
}

export interface ArtistSeoData {
  avatarUrl: string | null;
  bio: string | null;
  coverImageUrl: string | null;
  genre: string | null;
  name: string;
  username: string;
}

export interface ProjectSeoData {
  artistName: string | null;
  coverArtUrl: string | null;
  description: string | null;
  id: string;
  projectType: string;
  releaseDate: string | null;
  slug: string | null;
  title: string;
  trackCount: number;
}

export interface VideoSeoData {
  creatorName: string | null;
  creatorUsername: string | null;
  description: string | null;
  id: string;
  regionSlug: string | null;
  slug: string | null;
  thumbnailUrl: string | null;
  title: string;
  videoKind: string;
}

const readObject = (value: unknown): Record<string, unknown> =>
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {},
  readString = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value.trim() : null;

export const loadPublicTrackSeo = async (
  lookupId: string
): Promise<TrackSeoData | null> => {
  const response = await fetch(
    `${API_V1_URL}/tracks/${encodeURIComponent(lookupId)}`
  );

  if (!response.ok) {
    return null;
  }

  const rawTrack = readObject(await response.json()),
    rawArtist = readObject(rawTrack.artist),
    id = readString(rawTrack.id),
    title = readString(rawTrack.title);

  if (!(id && title)) {
    return null;
  }

  return {
    artist: {
      handle:
        readString(rawArtist.handle) ?? readString(rawArtist.id) ?? "artist",
      name: readString(rawArtist.name) ?? "SoundKit artist",
    },
    coverArtUrl: readString(rawTrack.coverArtUrl),
    description: readString(rawTrack.description),
    durationMs:
      typeof rawTrack.durationMs === "number"
        ? Math.round(rawTrack.durationMs)
        : null,
    genre: readString(rawTrack.genre),
    id,
    playbackUrl: readString(rawTrack.playbackUrl),
    regionSlug: readString(rawTrack.regionSlug),
    slug: readString(rawTrack.slug),
    title,
  };
};

export const loadPublicArtistSeo = async (
  username: string
): Promise<ArtistSeoData | null> => {
  const response = await fetch(
    `${API_V1_URL}/artists/${encodeURIComponent(username)}`
  );

  if (!response.ok) {
    return null;
  }

  const rawArtist = readObject(await response.json()),
    artistName = readString(rawArtist.name),
    artistUsername = readString(rawArtist.username);

  if (!(artistName && artistUsername)) {
    return null;
  }

  return {
    avatarUrl: readString(rawArtist.avatarUrl),
    bio: readString(rawArtist.bio),
    coverImageUrl: readString(rawArtist.coverImageUrl),
    genre: readString(rawArtist.genre),
    name: artistName,
    username: artistUsername,
  };
};

export const loadPublicProjectSeo = async (
  projectId: string
): Promise<ProjectSeoData | null> => {
  const response = await fetch(
    `${API_V1_URL}/projects/public/${encodeURIComponent(projectId)}`
  );

  if (!response.ok) {
    return null;
  }

  const rawProject = readObject(await response.json()),
    id = readString(rawProject.id),
    title = readString(rawProject.title);

  if (!(id && title)) {
    return null;
  }

  return {
    artistName: readString(rawProject.artistName),
    coverArtUrl: readString(rawProject.coverArtUrl),
    description: readString(rawProject.description),
    id,
    projectType: readString(rawProject.projectType) ?? "project",
    releaseDate: readString(rawProject.releaseDate),
    slug: readString(rawProject.slug),
    title,
    trackCount:
      typeof rawProject.trackCount === "number" ? rawProject.trackCount : 0,
  };
};

export const loadPublicVideoSeo = async (
  lookupId: string
): Promise<VideoSeoData | null> => {
  const response = await fetch(
    `${API_V1_URL}/videos/${encodeURIComponent(lookupId)}`
  );

  if (!response.ok) {
    return null;
  }

  const rawVideo = readObject(await response.json()),
    id = readString(rawVideo.id),
    title = readString(rawVideo.title);

  if (!(id && title)) {
    return null;
  }

  return {
    creatorName: readString(rawVideo.creatorName),
    creatorUsername: readString(rawVideo.creatorUsername),
    description: readString(rawVideo.description),
    id,
    regionSlug: readString(rawVideo.regionSlug),
    slug: readString(rawVideo.slug),
    thumbnailUrl: readString(rawVideo.thumbnailUrl),
    title,
    videoKind: readString(rawVideo.videoKind) ?? "video",
  };
};
