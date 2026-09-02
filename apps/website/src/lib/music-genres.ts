export const musicGenres = [
  { label: "Hip-Hop", value: "hip-hop-rap" },
  { label: "R&B/Soul", value: "rb-soul" },
  { label: "Electronic", value: "electronic" },
  { label: "Pop", value: "pop" },
  { label: "Spoken Word", value: "spoken-word" },
  { label: "Rock", value: "rock" },
  { label: "Jazz", value: "jazz" },
  { label: "Afrobeats", value: "afrobeats" },
  { label: "Latin", value: "latin" },
  { label: "Country", value: "country" },
  { label: "Reggae", value: "reggae" },
  { label: "Indie", value: "indie" },
  { label: "Metal", value: "metal" },
] as const;

export type MusicGenre = (typeof musicGenres)[number];

export const allGenreOptions = [
  { label: "All Genres", value: "all" },
  ...musicGenres,
] as const;

const normalizeGenreForDisplay = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/gu, "-")
      .replaceAll(/^-+|-+$/gu, ""),
  genreDisplayAliases: Record<string, string> = {
    "hip-hop": "Hip-Hop",
    "hip-hop-rap": "Hip-Hop",
    hiphop: "Hip-Hop",
  };

export const genreLabelFromValue = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "";
  }

  const normalizedValue = normalizeGenreForDisplay(trimmedValue),
    aliasedValue = genreDisplayAliases[normalizedValue],
    matchingGenre = musicGenres.find(
      (genre) =>
        genre.value === normalizedValue ||
        normalizeGenreForDisplay(genre.label) === normalizedValue
    );

  if (aliasedValue) {
    return aliasedValue;
  }
  if (matchingGenre) {
    return matchingGenre.label;
  }

  return trimmedValue
    .split(/[-_\s]+/u)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export const genreValueFromLabel = (label: string) => {
  const normalized = label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");

  if (normalized === "r-b-soul") {
    return "rb-soul";
  }

  return normalized === "hip-hop-rap" ? "hip-hop-rap" : normalized;
};

export const canonicalGenreName = (value?: string | null) =>
  value && value.trim().length > 0 ? genreLabelFromValue(value) : "Hip-Hop";
