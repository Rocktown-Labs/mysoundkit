export const musicGenres = [
  { label: "Hip-Hop/Rap", value: "hip-hop-rap" },
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

export const allGenreOptions = [
  { label: "All Genres", value: "all" },
  ...musicGenres,
] as const;

export const genreLabelFromValue = (value: string) =>
  musicGenres.find((genre) => genre.value === value)?.label ?? value;

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

export const canonicalGenreName = (value?: string | null) => {
  if (!value || value.trim().length === 0) {
    return "Hip-Hop/Rap";
  }
  const normalized = value.toLowerCase().trim(),
    found = musicGenres.find(
      (genre) =>
        genre.value.toLowerCase() === normalized ||
        genre.label.toLowerCase() === normalized
    );
  if (found) {
    return found.label;
  }
  return value
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};
