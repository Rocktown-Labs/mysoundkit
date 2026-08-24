export type MapScope =
  | "global"
  /** @deprecated Use "usa". Retained for dashboard compatibility and URL migration. */
  | "north-america"
  | "usa"
  | "canada"
  | "mexico"
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
    id: "usa",
    label: "USA",
    projection: "geoMercator",
    scale: 330,
  },
  {
    center: [-105, 58],
    id: "canada",
    label: "Canada",
    projection: "geoMercator",
    scale: 270,
  },
  {
    center: [-102, 23],
    id: "mexico",
    label: "Mexico",
    projection: "geoMercator",
    scale: 400,
  },
  {
    center: [18, 2],
    id: "africa",
    label: "Africa",
    projection: "geoMercator",
    scale: 300,
  },
  {
    center: [15, 54],
    id: "europe",
    label: "Europe",
    projection: "geoMercator",
    scale: 300,
  },
  {
    center: [85, 32],
    id: "asia",
    label: "Asia",
    projection: "geoMercator",
    scale: 320,
  },
  {
    center: [-65, -15],
    id: "latin-america",
    label: "Latin America",
    projection: "geoMercator",
    scale: 300,
  },
  {
    center: [135, -25],
    id: "oceania",
    label: "Oceania",
    projection: "geoMercator",
    scale: 420,
  },
];
