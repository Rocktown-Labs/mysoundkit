interface LiveCollectionItem {
  genre?: string | null;
  startsAt?: string | null;
  status: string;
  title: string;
  viewerCount?: number;
}

export const normalizeGenreValue = (genre?: string | null) => {
  if (!genre) {
    return "";
  }
  return genre
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");
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
