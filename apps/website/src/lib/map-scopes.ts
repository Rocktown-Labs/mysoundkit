export type MapScope =
  | "global"
  | "north-america"
  | "africa"
  | "europe"
  | "asia"
  | "latin-america"
  | "oceania";

export interface RegionOption {
  center?: [number, number];
  id: MapScope;
  label: string;
  projection: "geoAlbersUsa" | "geoMercator" | "geoEqualEarth";
  scale: number;
}

export const mapScopes: RegionOption[] = [
  {
    center: [0, 8],
    id: "global",
    label: "Global",
    projection: "geoEqualEarth",
    scale: 180,
  },
  {
    center: [-100, 42],
    id: "north-america",
    label: "USA / North America",
    projection: "geoMercator",
    scale: 330,
  },
  {
    center: [18, 2],
    id: "africa",
    label: "Africa",
    projection: "geoMercator",
    scale: 220,
  },
  {
    center: [15, 52],
    id: "europe",
    label: "Europe",
    projection: "geoMercator",
    scale: 350,
  },
  {
    center: [85, 32],
    id: "asia",
    label: "Asia",
    projection: "geoMercator",
    scale: 200,
  },
  {
    center: [-65, -15],
    id: "latin-america",
    label: "Latin America",
    projection: "geoMercator",
    scale: 250,
  },
  {
    center: [135, -25],
    id: "oceania",
    label: "Oceania",
    projection: "geoMercator",
    scale: 300,
  },
];
