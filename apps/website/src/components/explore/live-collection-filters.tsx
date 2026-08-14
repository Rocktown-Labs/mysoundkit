import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { musicGenres } from "@/lib/music-genres";

export interface LiveCollectionFilterValue {
  genre: string;
  sort: string;
  status: string;
}

export function LiveCollectionFilters({
  onChange,
  value,
}: {
  onChange: (value: LiveCollectionFilterValue) => void;
  value: LiveCollectionFilterValue;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Select
        onValueChange={(genre) => onChange({ ...value, genre })}
        value={value.genre}
      >
        <SelectTrigger aria-label="Filter live events by genre">
          <SelectValue placeholder="All genres" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All genres</SelectItem>
          {musicGenres.map((genre) => (
            <SelectItem key={genre.value} value={genre.value}>
              {genre.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        onValueChange={(status) => onChange({ ...value, status })}
        value={value.status}
      >
        <SelectTrigger aria-label="Filter live events by status">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="live">Live now</SelectItem>
          <SelectItem value="scheduled">Upcoming</SelectItem>
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
