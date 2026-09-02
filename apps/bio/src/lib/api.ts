/* eslint-disable one-var, sort-vars */

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
    (import.meta.env.DEV ? "http://localhost:3002" : "https://soundkit.bio")
);
export const STRIPE_PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

export interface BioArtist {
  avatarUrl?: string | null;
  bio?: string | null;
  coverImageUrl?: string | null;
  followers: number;
  genre: string;
  id: string;
  links?: Record<string, string | undefined>;
  location: string;
  name: string;
  trackCount?: number;
  username: string;
  verified: boolean;
}

export interface BioTrack {
  artistName: string;
  coverArtUrl?: string | null;
  duration: string;
  id: string;
  mediaReady?: boolean;
  playbackUrl?: string | null;
  plays: number;
  title: string;
}

interface BioMedia {
  featuredTracks: BioTrack[];
  tracks: BioTrack[];
  videos: { id: string; thumbnailUrl?: string | null; title: string }[];
}

export interface BioProfile {
  artist: BioArtist;
  media: BioMedia;
}

const emptyMedia: BioMedia = {
    featuredTracks: [],
    tracks: [],
    videos: [],
  },
  readJson = (response: Response) => {
    if (!response.ok) {
      return null;
    }

    return response.json();
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

  const media = (await readJson(mediaResponse)) ?? emptyMedia;
  return {
    artist: artist as BioArtist,
    media: media as BioMedia,
  };
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
