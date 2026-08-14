interface LiveCollectionItem {
  genre?: string | null;
  startsAt?: string | null;
  status: string;
  title: string;
  viewerCount?: number;
}

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
  const filteredItems = items.filter(
    (item) =>
      (genre === "all" || item.genre === genre) &&
      (status === "all" || item.status === status)
  );

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
