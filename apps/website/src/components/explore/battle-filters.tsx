import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

const northAmericaLocations = [
  { value: "all", label: "All North America" },
  { value: "us-alabama", label: "Alabama, US" },
  { value: "us-alaska", label: "Alaska, US" },
  { value: "us-arizona", label: "Arizona, US" },
  { value: "us-arkansas", label: "Arkansas, US" },
  { value: "us-california", label: "California, US" },
  { value: "us-colorado", label: "Colorado, US" },
  { value: "us-connecticut", label: "Connecticut, US" },
  { value: "us-delaware", label: "Delaware, US" },
  { value: "us-florida", label: "Florida, US" },
  { value: "us-georgia", label: "Georgia, US" },
  { value: "us-hawaii", label: "Hawaii, US" },
  { value: "us-idaho", label: "Idaho, US" },
  { value: "us-illinois", label: "Illinois, US" },
  { value: "us-indiana", label: "Indiana, US" },
  { value: "us-iowa", label: "Iowa, US" },
  { value: "us-kansas", label: "Kansas, US" },
  { value: "us-kentucky", label: "Kentucky, US" },
  { value: "us-louisiana", label: "Louisiana, US" },
  { value: "us-maine", label: "Maine, US" },
  { value: "us-maryland", label: "Maryland, US" },
  { value: "us-massachusetts", label: "Massachusetts, US" },
  { value: "us-michigan", label: "Michigan, US" },
  { value: "us-minnesota", label: "Minnesota, US" },
  { value: "us-mississippi", label: "Mississippi, US" },
  { value: "us-missouri", label: "Missouri, US" },
  { value: "us-montana", label: "Montana, US" },
  { value: "us-nebraska", label: "Nebraska, US" },
  { value: "us-nevada", label: "Nevada, US" },
  { value: "us-new-hampshire", label: "New Hampshire, US" },
  { value: "us-new-jersey", label: "New Jersey, US" },
  { value: "us-new-mexico", label: "New Mexico, US" },
  { value: "us-new-york", label: "New York, US" },
  { value: "us-north-carolina", label: "North Carolina, US" },
  { value: "us-north-dakota", label: "North Dakota, US" },
  { value: "us-ohio", label: "Ohio, US" },
  { value: "us-oklahoma", label: "Oklahoma, US" },
  { value: "us-oregon", label: "Oregon, US" },
  { value: "us-pennsylvania", label: "Pennsylvania, US" },
  { value: "us-rhode-island", label: "Rhode Island, US" },
  { value: "us-south-carolina", label: "South Carolina, US" },
  { value: "us-south-dakota", label: "South Dakota, US" },
  { value: "us-tennessee", label: "Tennessee, US" },
  { value: "us-texas", label: "Texas, US" },
  { value: "us-utah", label: "Utah, US" },
  { value: "us-vermont", label: "Vermont, US" },
  { value: "us-virginia", label: "Virginia, US" },
  { value: "us-washington", label: "Washington, US" },
  { value: "us-west-virginia", label: "West Virginia, US" },
  { value: "us-wisconsin", label: "Wisconsin, US" },
  { value: "us-wyoming", label: "Wyoming, US" },
  { value: "canada", label: "Canada" },
  { value: "mexico", label: "Mexico" },
]

const globalLocations = [
  { value: "all", label: "All Global" },
  { value: "africa", label: "Africa" },
  { value: "asia", label: "Asia" },
  { value: "europe", label: "Europe" },
  { value: "south-america", label: "South America" },
  { value: "australia", label: "Australia & Oceania" },
  { value: "antarctica", label: "Antarctica" },
]

const genres = [
  { value: "all", label: "All Genres" },
  { value: "hip-hop", label: "Hip-Hop" },
  { value: "rb-soul", label: "R&B/Soul" },
  { value: "electronic", label: "Electronic" },
  { value: "pop", label: "Pop" },
  { value: "rock", label: "Rock" },
  { value: "jazz", label: "Jazz" },
  { value: "afrobeats", label: "Afrobeats" },
  { value: "latin", label: "Latin" },
  { value: "country", label: "Country" },
  { value: "reggae", label: "Reggae" },
  { value: "indie", label: "Indie" },
  { value: "metal", label: "Metal" },
]

interface BattleFiltersProps {
  regionType: "north-america" | "global"
  region: string
  genre: string
  sort: string
  onRegionTypeChange: (value: "north-america" | "global") => void
  onRegionChange: (value: string) => void
  onGenreChange: (value: string) => void
  onSortChange: (value: string) => void
  sortOptions: { value: string; label: string }[]
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
              onRegionTypeChange("north-america")
              onRegionChange(value)
            }}
            disabled={regionType === "global"}
          >
            <SelectTrigger id="north-america" className={regionType === "global" ? "opacity-50" : ""}>
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
              onRegionTypeChange("global")
              onRegionChange(value)
            }}
            disabled={regionType === "north-america"}
          >
            <SelectTrigger id="global" className={regionType === "north-america" ? "opacity-50" : ""}>
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
  )
}
