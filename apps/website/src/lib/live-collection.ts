interface LiveCollectionItem {
  genre?: string | null;
  startsAt?: string | null;
  status: string;
  title: string;
  viewerCount?: number;
}

const genreAliases: Record<string, string> = {
  "hip-hop-rap": "hip-hop",
  hiphop: "hip-hop",
  "r-b-soul": "rb-soul",
};

export const normalizeGenreValue = (genre?: string | null) => {
  if (!genre) {
    return "";
  }

  const normalized = genre
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");
  return genreAliases[normalized] ?? normalized;
};

export const filterAndSortLiveItems = <T extends LiveCollectionItem>({
  genre,
  items,
  sort,
  status,
}: {
  genre: string;
  items: T[];
  sort: string;
  status: string;
}) => {
  const targetGenre = normalizeGenreValue(genre),
    filteredItems = items.filter((item) => {
      const matchesGenre =
          genre === "all" ||
          item.genre === genre ||
          normalizeGenreValue(item.genre) === targetGenre ||
          normalizeGenreValue(item.genre).startsWith(targetGenre) ||
          targetGenre.startsWith(normalizeGenreValue(item.genre)),
        matchesStatus = status === "all" || item.status === status;
      return matchesGenre && matchesStatus;
    });

  return [...filteredItems].sort((first, second) => {
    if (sort === "viewers-desc") {
      return (second.viewerCount ?? 0) - (first.viewerCount ?? 0);
    }
    if (sort === "title-asc") {
      return first.title.localeCompare(second.title);
    }
    return (
      new Date(first.startsAt ?? 0).getTime() -
      new Date(second.startsAt ?? 0).getTime()
    );
  });
};
