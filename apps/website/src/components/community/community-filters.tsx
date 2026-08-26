import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { musicGenres } from "@/lib/music-genres";

export interface CommunityFilterValue {
  access: "all" | "free" | "paid";
  genre: string;
  q: string;
  sort: "activity-desc" | "members-desc" | "name-asc" | "newest-desc";
}

export function CommunityFilters({
  onChange,
  value,
}: {
  onChange: (value: CommunityFilterValue) => void;
  value: CommunityFilterValue;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Search communities"
          className="pl-9"
          onChange={(event) => onChange({ ...value, q: event.target.value })}
          placeholder="Search communities"
          type="search"
          value={value.q}
        />
      </div>
      <Select
        onValueChange={(genre) => onChange({ ...value, genre })}
        value={value.genre}
      >
        <SelectTrigger aria-label="Filter communities by genre">
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
        onValueChange={(access: CommunityFilterValue["access"]) =>
          onChange({ ...value, access })
        }
        value={value.access}
      >
        <SelectTrigger aria-label="Filter communities by access">
          <SelectValue placeholder="Free and paid" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Free and paid</SelectItem>
          <SelectItem value="free">Free communities</SelectItem>
          <SelectItem value="paid">Paid communities</SelectItem>
        </SelectContent>
      </Select>
      <Select
        onValueChange={(sort: CommunityFilterValue["sort"]) =>
          onChange({ ...value, sort })
        }
        value={value.sort}
      >
        <SelectTrigger aria-label="Sort communities">
          <SelectValue placeholder="Most active" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="activity-desc">Most active</SelectItem>
          <SelectItem value="members-desc">Most members</SelectItem>
          <SelectItem value="newest-desc">Newest</SelectItem>
          <SelectItem value="name-asc">Name A–Z</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
