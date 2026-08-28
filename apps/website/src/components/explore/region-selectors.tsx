import {
  globalLocations,
  northAmericaLocations,
} from "@/components/explore/battle-filters";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RegionSelectorsProps {
  className?: string;
  onChange: (value: {
    region: string;
    regionType: "global" | "north-america";
  }) => void;
  region: string;
  regionType: "global" | "north-america";
}

export function RegionSelectors({
  className,
  onChange,
  region,
  regionType,
}: RegionSelectorsProps) {
  return (
    <div className={className ?? "grid gap-4 sm:grid-cols-2"}>
      <div className="space-y-2">
        <Label htmlFor="regional-north-america">North America</Label>
        <Select
          onValueChange={(value) =>
            onChange({ region: value, regionType: "north-america" })
          }
          value={regionType === "north-america" ? region : ""}
        >
          <SelectTrigger id="regional-north-america">
            <SelectValue placeholder="Select state or country" />
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
      <div className="space-y-2">
        <Label htmlFor="regional-global">Global</Label>
        <Select
          onValueChange={(value) =>
            onChange({ region: value, regionType: "global" })
          }
          value={regionType === "global" ? region : ""}
        >
          <SelectTrigger id="regional-global">
            <SelectValue placeholder="Select platform-wide or continent" />
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
    </div>
  );
}
