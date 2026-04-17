import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const northAmericaLocations = [
  { label: "All North America", value: "all" },
  { label: "Alabama, US", value: "us-alabama" },
  { label: "Alaska, US", value: "us-alaska" },
  { label: "Arizona, US", value: "us-arizona" },
  { label: "Arkansas, US", value: "us-arkansas" },
  { label: "California, US", value: "us-california" },
  { label: "Colorado, US", value: "us-colorado" },
  { label: "Connecticut, US", value: "us-connecticut" },
  { label: "Delaware, US", value: "us-delaware" },
  { label: "Florida, US", value: "us-florida" },
  { label: "Georgia, US", value: "us-georgia" },
  { label: "Hawaii, US", value: "us-hawaii" },
  { label: "Idaho, US", value: "us-idaho" },
  { label: "Illinois, US", value: "us-illinois" },
  { label: "Indiana, US", value: "us-indiana" },
  { label: "Iowa, US", value: "us-iowa" },
  { label: "Kansas, US", value: "us-kansas" },
  { label: "Kentucky, US", value: "us-kentucky" },
  { label: "Louisiana, US", value: "us-louisiana" },
  { label: "Maine, US", value: "us-maine" },
  { label: "Maryland, US", value: "us-maryland" },
  { label: "Massachusetts, US", value: "us-massachusetts" },
  { label: "Michigan, US", value: "us-michigan" },
  { label: "Minnesota, US", value: "us-minnesota" },
  { label: "Mississippi, US", value: "us-mississippi" },
  { label: "Missouri, US", value: "us-missouri" },
  { label: "Montana, US", value: "us-montana" },
  { label: "Nebraska, US", value: "us-nebraska" },
  { label: "Nevada, US", value: "us-nevada" },
  { label: "New Hampshire, US", value: "us-new-hampshire" },
  { label: "New Jersey, US", value: "us-new-jersey" },
  { label: "New Mexico, US", value: "us-new-mexico" },
  { label: "New York, US", value: "us-new-york" },
  { label: "North Carolina, US", value: "us-north-carolina" },
  { label: "North Dakota, US", value: "us-north-dakota" },
  { label: "Ohio, US", value: "us-ohio" },
  { label: "Oklahoma, US", value: "us-oklahoma" },
  { label: "Oregon, US", value: "us-oregon" },
  { label: "Pennsylvania, US", value: "us-pennsylvania" },
  { label: "Rhode Island, US", value: "us-rhode-island" },
  { label: "South Carolina, US", value: "us-south-carolina" },
  { label: "South Dakota, US", value: "us-south-dakota" },
  { label: "Tennessee, US", value: "us-tennessee" },
  { label: "Texas, US", value: "us-texas" },
  { label: "Utah, US", value: "us-utah" },
  { label: "Vermont, US", value: "us-vermont" },
  { label: "Virginia, US", value: "us-virginia" },
  { label: "Washington, US", value: "us-washington" },
  { label: "West Virginia, US", value: "us-west-virginia" },
  { label: "Wisconsin, US", value: "us-wisconsin" },
  { label: "Wyoming, US", value: "us-wyoming" },
  { label: "Canada", value: "canada" },
  { label: "Mexico", value: "mexico" },
];

const globalLocations = [
  { label: "All Global", value: "all" },
  { label: "Africa", value: "africa" },
  { label: "Asia", value: "asia" },
  { label: "Europe", value: "europe" },
  { label: "South America", value: "south-america" },
  { label: "Australia & Oceania", value: "australia" },
  { label: "Antarctica", value: "antarctica" },
];

const genres = [
  { label: "All Genres", value: "all" },
  { label: "Hip-Hop", value: "hip-hop" },
  { label: "R&B/Soul", value: "rb-soul" },
  { label: "Electronic", value: "electronic" },
  { label: "Pop", value: "pop" },
  { label: "Rock", value: "rock" },
  { label: "Jazz", value: "jazz" },
  { label: "Afrobeats", value: "afrobeats" },
  { label: "Latin", value: "latin" },
  { label: "Country", value: "country" },
  { label: "Reggae", value: "reggae" },
  { label: "Indie", value: "indie" },
  { label: "Metal", value: "metal" },
];

interface BattleFiltersProps {
  regionType: "north-america" | "global";
  region: string;
  genre: string;
  sort: string;
  onRegionTypeChange: (value: "north-america" | "global") => void;
  onRegionChange: (value: string) => void;
  onGenreChange: (value: string) => void;
  onSortChange: (value: string) => void;
  sortOptions: { value: string; label: string }[];
}

export function BattleFilters({
  regionType,
  region,
  genre,
  sort,
  onRegionTypeChange,
  onRegionChange,
  onGenreChange,
  onSortChange,
  sortOptions,
}: BattleFiltersProps) {
  return (
    <div className="space-y-6 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* North America Select */}
        <div className="space-y-2">
          <Label htmlFor="north-america" className="text-sm font-medium">
            North America
          </Label>
          <Select
            value={regionType === "north-america" ? region : ""}
            onValueChange={(value) => {
              onRegionTypeChange("north-america");
              onRegionChange(value);
            }}
            disabled={regionType === "global"}
          >
            <SelectTrigger
              id="north-america"
              className={regionType === "global" ? "opacity-50" : ""}
            >
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {northAmericaLocations.map((location) => (
                <SelectItem key={location.value} value={location.value}>
                  {location.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Global Select */}
        <div className="space-y-2">
          <Label htmlFor="global" className="text-sm font-medium">
            Global
          </Label>
          <Select
            value={regionType === "global" ? region : ""}
            onValueChange={(value) => {
              onRegionTypeChange("global");
              onRegionChange(value);
            }}
            disabled={regionType === "north-america"}
          >
            <SelectTrigger
              id="global"
              className={regionType === "north-america" ? "opacity-50" : ""}
            >
              <SelectValue placeholder="Select continent" />
            </SelectTrigger>
            <SelectContent>
              {globalLocations.map((location) => (
                <SelectItem key={location.value} value={location.value}>
                  {location.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Genre Select */}
        <div className="space-y-2">
          <Label htmlFor="genre" className="text-sm font-medium">
            Genre
          </Label>
          <Select value={genre} onValueChange={onGenreChange}>
            <SelectTrigger id="genre">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {genres.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sort Select */}
        <div className="space-y-2">
          <Label htmlFor="sort" className="text-sm font-medium">
            Sort By
          </Label>
          <Select value={sort} onValueChange={onSortChange}>
            <SelectTrigger id="sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
