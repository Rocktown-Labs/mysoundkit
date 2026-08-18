export interface GenreCatalogEntry {
  id: string;
  name: string;
  slug: string;
}

export const genreCatalog: GenreCatalogEntry[] = [
  { id: "g_hip_hop", name: "Hip Hop", slug: "hip-hop" },
  { id: "g_rb_soul", name: "R&B/Soul", slug: "rb-soul" },
  { id: "g_electronic", name: "Electronic", slug: "electronic" },
  { id: "g_pop", name: "Pop", slug: "pop" },
  { id: "g_spoken_word", name: "Spoken Word", slug: "spoken-word" },
  { id: "g_rock", name: "Rock", slug: "rock" },
  { id: "g_jazz", name: "Jazz", slug: "jazz" },
  { id: "g_afrobeats", name: "Afrobeats", slug: "afrobeats" },
  { id: "g_latin", name: "Latin", slug: "latin" },
  { id: "g_country", name: "Country", slug: "country" },
  { id: "g_reggae", name: "Reggae", slug: "reggae" },
  { id: "g_indie", name: "Indie", slug: "indie" },
  { id: "g_metal", name: "Metal", slug: "metal" },
];

const genreByName = new Map(
    genreCatalog.map((genre) => [genre.name.toLowerCase(), genre])
  ),
  genreBySlug = new Map(genreCatalog.map((genre) => [genre.slug, genre])),
  genreValueAliases = new Map([
    ["hip-hop-rap", "hip-hop"],
    ["hiphop", "hip-hop"],
    ["rb", "rb-soul"],
    ["r-b-soul", "rb-soul"],
    ["r&b", "rb-soul"],
    ["r&b/soul", "rb-soul"],
    ["electronic-dance", "electronic"],
    ["edm", "electronic"],
    ["spokenword", "spoken-word"],
  ]);

export const slugifyGenre = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/(^-|-$)/gu, "");

export const canonicalGenreName = (value: string) => {
  const slug = canonicalGenreSlug(value);

  return (
    genreBySlug.get(slug)?.name ??
    genreByName.get(value.toLowerCase())?.name ??
    value
  );
};

export const canonicalGenreSlug = (value: string) => {
  const slug = slugifyGenre(value);

  return genreValueAliases.get(slug) ?? slug;
};
