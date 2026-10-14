/* oxlint-disable one-var, sort-vars */
/** Shared genre presentation metadata (emoji, blurb, canonical query value).
 * Mirrors the web app's local genreData map in
 * apps/website/src/app/_explore/genres/$id.tsx. */

export interface GenreMeta {
  description: string;
  emoji: string;
  name: string;
  /** Canonical value the API expects for this genre (route slug may differ). */
  queryGenre: string;
}

export const GENRE_META: Record<string, GenreMeta> = {
  afrobeats: {
    description: "African rhythms and melodies",
    emoji: "🥁",
    name: "Afrobeats",
    queryGenre: "afrobeats",
  },
  country: {
    description: "Storytelling from the heartland",
    emoji: "🤠",
    name: "Country",
    queryGenre: "country",
  },
  electronic: {
    description: "Digital sounds and beats",
    emoji: "🎹",
    name: "Electronic",
    queryGenre: "electronic",
  },
  "hip-hop": {
    description: "Beats, rhymes, and culture",
    emoji: "🎤",
    name: "Hip-Hop",
    queryGenre: "hip-hop-rap",
  },
  indie: {
    description: "Independent spirit and sound",
    emoji: "🎧",
    name: "Indie",
    queryGenre: "indie",
  },
  jazz: {
    description: "Improvisation and swing",
    emoji: "🎺",
    name: "Jazz",
    queryGenre: "jazz",
  },
  latin: {
    description: "Latin rhythms and passion",
    emoji: "💃",
    name: "Latin",
    queryGenre: "latin",
  },
  metal: {
    description: "Heavy riffs and power",
    emoji: "🤘",
    name: "Metal",
    queryGenre: "metal",
  },
  pop: {
    description: "Chart-topping hits",
    emoji: "⭐",
    name: "Pop",
    queryGenre: "pop",
  },
  "rb-soul": {
    description: "Smooth vibes and soulful vocals",
    emoji: "🎵",
    name: "R&B/Soul",
    queryGenre: "rb-soul",
  },
  reggae: {
    description: "Island grooves and unity",
    emoji: "🌴",
    name: "Reggae",
    queryGenre: "reggae",
  },
  rock: {
    description: "Guitar-driven anthems",
    emoji: "🎸",
    name: "Rock",
    queryGenre: "rock",
  },
  "spoken-word": {
    description: "Poetry and performance",
    emoji: "🎙️",
    name: "Spoken Word",
    queryGenre: "spoken-word",
  },
};

export const genreEmoji = (slug: string): string =>
  GENRE_META[slug]?.emoji ?? "🎵";

export const genreMetaFor = (slug: string): GenreMeta =>
  GENRE_META[slug] ?? {
    description: "Sounds from across SoundKit",
    emoji: "🎵",
    name: slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    queryGenre: slug,
  };

export const formatGenreCount = (count: number): string => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10_000 ? 0 : 1)}K`;
  }
  return count.toLocaleString();
};

/** Genre activity label matching the web genres grid ("N live items"). */
export const genreActivityLabel = (count: number): string =>
  `${formatGenreCount(count)} ${count === 1 ? "live item" : "live items"}`;

const normalizeGenreSlug = (value: null | string | undefined): string =>
  (value ?? "")
    .toLowerCase()
    .replaceAll("&", "and")
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");

/** Loose genre match used to filter battles client-side, like the web. */
export const matchesGenre = (
  candidate: null | string | undefined,
  genreSlug: string
): boolean => {
  const candidateSlug = normalizeGenreSlug(candidate),
    targetSlug = normalizeGenreSlug(genreSlug);
  if (!candidateSlug || !targetSlug) {
    return false;
  }
  return (
    candidateSlug === targetSlug ||
    candidateSlug.includes(targetSlug) ||
    targetSlug.includes(candidateSlug)
  );
};
