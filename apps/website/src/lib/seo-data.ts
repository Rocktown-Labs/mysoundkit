import { API_V1_URL } from "@/lib/api";

export interface TrackSeoData {
  artist: {
    handle: string;
    name: string;
  };
  coverArtUrl: string | null;
  description: string | null;
  id: string;
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

const readObject = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const readString = (value: unknown): string | null =>
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

  const rawTrack = readObject(await response.json());
  const rawArtist = readObject(rawTrack.artist);
  const id = readString(rawTrack.id);
  const title = readString(rawTrack.title);

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
    id,
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

  const rawArtist = readObject(await response.json());
  const artistName = readString(rawArtist.name);
  const artistUsername = readString(rawArtist.username);

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
