import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeGenreValue } from "@/lib/live-collection";
import { useGenresQuery } from "@/lib/soundkit-api-hooks";

export interface LiveCollectionFilterValue {
  genre: string;
  sort: string;
}

export function LiveCollectionFilters({
  onChange,
  value,
}: {
  onChange: (value: LiveCollectionFilterValue) => void;
  value: LiveCollectionFilterValue;
}) {
  const { data: genres = [] } = useGenresQuery();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Select
        onValueChange={(genre) => onChange({ ...value, genre })}
        value={normalizeGenreValue(value.genre)}
      >
        <SelectTrigger aria-label="Filter live events by genre">
          <SelectValue placeholder="All genres" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All genres</SelectItem>
          {genres.map((genre) => (
            <SelectItem key={genre.slug} value={genre.slug}>
              {genre.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        onValueChange={(sort) => onChange({ ...value, sort })}
        value={value.sort}
      >
        <SelectTrigger aria-label="Sort live events">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="starts-asc">Soonest first</SelectItem>
          <SelectItem value="viewers-desc">Most viewers</SelectItem>
          <SelectItem value="title-asc">Title A–Z</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
