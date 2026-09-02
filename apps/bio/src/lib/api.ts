/* eslint-disable one-var, sort-vars, complexity */

const trimTrailingSlash = (value: string) => value.replace(/\/+$/u, "");

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_SERVER_URL || "http://localhost:3000"
);
export const API_V1_URL = `${API_BASE_URL}/v1`;
export const SOUNDKIT_WEB_URL = trimTrailingSlash(
  import.meta.env.VITE_SOUNDKIT_WEB_URL ||
    (import.meta.env.DEV ? "http://localhost:3001" : "https://mysoundkit.com")
);
export const SOUNDKIT_BIO_URL = trimTrailingSlash(
  import.meta.env.VITE_SOUNDKIT_BIO_URL ||
    (import.meta.env.DEV
      ? "http://localhost:3002"
      : "https://bio.mysoundkit.com")
);
export const STRIPE_PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

export interface BioArtist {
  avatarUrl?: string | null;
  battleCount?: number;
  bio?: string | null;
  coverImageUrl?: string | null;
  followers: number;
  genre: string;
  id: string;
  joinedAt?: string;
  links?: Record<string, string | undefined>;
  location: string;
  name: string;
  state?: string | null;
  trackCount?: number;
  username: string;
  verified: boolean;
  weeklyPlays?: number;
}

export interface BioStreamingLinks {
  appleMusic?: string;
  spotify?: string;
  youtube?: string;
}

export interface BioTrack {
  artistName: string;
  artistUsername?: string | null;
  bpm?: number | null;
  coverArtUrl?: string | null;
  duration: string;
  genre?: string;
  id: string;
  mediaReady?: boolean;
  musicalKey?: string | null;
  playbackUrl?: string | null;
  plays: number;
  previewUrl?: string | null;
  regionSlug?: string | null;
  slug?: string | null;
  streamingLinks?: BioStreamingLinks;
  title: string;
}

export interface BioProject {
  artistName: string;
  artistUsername?: string | null;
  coverArtUrl?: string | null;
  id: string;
  projectType: "album" | "ep" | "mixtape" | "single";
  releaseDate?: string | null;
  slug: string;
  title: string;
  trackCount: number;
}

export interface BioVideo {
  creatorAvatarUrl?: string | null;
  creatorName?: string;
  creatorUsername?: string;
  duration?: string;
  id: string;
  slug: string;
  thumbnailUrl?: string | null;
  title: string;
  viewCount?: string;
}

export interface BioCredit {
  contentId: string;
  contentType: "track" | "project";
  coverArtUrl?: string | null;
  id: string;
  ownerName: string;
  ownerUsername: string;
  projectType?: "album" | "ep" | "mixtape" | "single" | null;
  role: "producer" | "engineer" | "songwriter";
  slug: string;
  title: string;
}

export interface BioMedia {
  credits: BioCredit[];
  featuredProjects: BioProject[];
  featuredTracks: BioTrack[];
  projects: BioProject[];
  tracks: BioTrack[];
  videos: BioVideo[];
}

export interface BioLiveStream {
  creatorUsername: string;
  id: string;
  status: "live" | "ended" | "scheduled";
  title: string;
  viewerCount?: number;
}

export interface BioProfile {
  artist: BioArtist;
  live?: BioLiveStream | null;
  media: BioMedia;
}

export interface BioArtistSearchResult {
  avatarUrl?: string | null;
  followers: number;
  genre: string;
  id: string;
  location?: string;
  name: string;
  username: string;
  verified: boolean;
  weeklyPlays?: number;
}

const emptyMedia: BioMedia = {
    credits: [],
    featuredProjects: [],
    featuredTracks: [],
    projects: [],
    tracks: [],
    videos: [],
  },
  readJson = async (response: Response) => {
    if (!response.ok) {
      return null;
    }

    try {
      return await response.json();
    } catch {
      return null;
    }
  };

export const loadBioProfile = async (
  username: string
): Promise<BioProfile | null> => {
  const encodedUsername = encodeURIComponent(username),
    [artistResponse, mediaResponse] = await Promise.all([
      fetch(`${API_V1_URL}/artists/${encodedUsername}`, {
        headers: { Accept: "application/json" },
      }),
      fetch(`${API_V1_URL}/artists/${encodedUsername}/media`, {
        headers: { Accept: "application/json" },
      }),
    ]),
    artist = await readJson(artistResponse);

  if (!artist || typeof artist !== "object") {
    return null;
  }

  const rawMedia = await readJson(mediaResponse),
    rawRecord =
      rawMedia && typeof rawMedia === "object"
        ? (rawMedia as Record<string, unknown>)
        : null,
    media: BioMedia = rawRecord
      ? {
          credits: Array.isArray(rawRecord.credits)
            ? (rawRecord.credits as BioCredit[])
            : [],
          featuredProjects: Array.isArray(rawRecord.featuredProjects)
            ? (rawRecord.featuredProjects as BioProject[])
            : [],
          featuredTracks: Array.isArray(rawRecord.featuredTracks)
            ? (rawRecord.featuredTracks as BioTrack[])
            : [],
          projects: Array.isArray(rawRecord.projects)
            ? (rawRecord.projects as BioProject[])
            : [],
          tracks: Array.isArray(rawRecord.tracks)
            ? (rawRecord.tracks as BioTrack[])
            : [],
          videos: Array.isArray(rawRecord.videos)
            ? (rawRecord.videos as BioVideo[])
            : [],
        }
      : emptyMedia;

  return {
    artist: artist as BioArtist,
    media,
  };
};

export const loadBioTrack = async (
  trackId: string
): Promise<BioTrack | null> => {
  const encodedId = encodeURIComponent(trackId),
    response = await fetch(`${API_V1_URL}/tracks/${encodedId}`, {
      headers: { Accept: "application/json" },
    }),
    data = await readJson(response);

  if (!data || typeof data !== "object") {
    return null;
  }

  return data as BioTrack;
};

export const searchBioArtists = async (
  query: string,
  limit = 8
): Promise<BioArtistSearchResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const response = await fetch(
      `${API_V1_URL}/search?type=artists&limit=${limit}&q=${encodeURIComponent(trimmed)}`,
      { headers: { Accept: "application/json" } }
    ),
    data = await readJson(response),
    record =
      data && typeof data === "object"
        ? (data as Record<string, unknown>)
        : null;

  if (record && Array.isArray(record.artists)) {
    return record.artists as BioArtistSearchResult[];
  }

  return [];
};

export const loadRegionArtists = async (
  region = "us-arkansas",
  regionType = "north-america"
): Promise<BioArtistSearchResult[]> => {
  try {
    const response = await fetch(
        `${API_V1_URL}/discover/artists?region=${encodeURIComponent(region)}&regionType=${encodeURIComponent(regionType)}&category=rising&limit=12`,
        { headers: { Accept: "application/json" } }
      ),
      data = await readJson(response),
      record =
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : null;

    if (record && Array.isArray(record.artists)) {
      return record.artists as BioArtistSearchResult[];
    }

    return [];
  } catch {
    return [];
  }
};

export const isSafeExternalUrl = (value: string | undefined) => {
  if (!value) {
    return false;
  }

  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

export const buildSoundKitWebUrl = (path: string, refArtist?: string) => {
  const base = `${SOUNDKIT_WEB_URL}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const url = new URL(base);
    url.searchParams.set("utm_source", "soundkit_bio");
    url.searchParams.set("utm_medium", "social_link");
    if (refArtist) {
      url.searchParams.set("ref", `bio_${refArtist}`);
    }
    return url.toString();
  } catch {
    return base;
  }
};
