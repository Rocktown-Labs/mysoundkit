export type MapScope =
  | "africa"
  | "asia"
  | "canada"
  | "europe"
  | "global"
  | "latin-america"
  | "mexico"
  | "oceania"
  | "usa";

export type RegionType = "global" | "north-america";

export interface RegionOption {
  description: string;
  icon: string;
  id: MapScope;
  label: string;
}

// Mirrors the web app's region scopes (see apps/website/src/lib/map-scopes.ts)
// trimmed to what the native region card needs.
export const mapScopes: RegionOption[] = [
  {
    description: "Every scene on SoundKit",
    icon: "globe-outline",
    id: "global",
    label: "Global",
  },
  {
    description: "United States charts and drops",
    icon: "flag-outline",
    id: "usa",
    label: "USA",
  },
  {
    description: "Canadian charts and drops",
    icon: "flag-outline",
    id: "canada",
    label: "Canada",
  },
  {
    description: "Mexican charts and drops",
    icon: "flag-outline",
    id: "mexico",
    label: "Mexico",
  },
  {
    description: "African charts and drops",
    icon: "flag-outline",
    id: "africa",
    label: "Africa",
  },
  {
    description: "European charts and drops",
    icon: "flag-outline",
    id: "europe",
    label: "Europe",
  },
  {
    description: "Asian charts and drops",
    icon: "flag-outline",
    id: "asia",
    label: "Asia",
  },
  {
    description: "Latin American charts and drops",
    icon: "flag-outline",
    id: "latin-america",
    label: "Latin America",
  },
  {
    description: "Oceanian charts and drops",
    icon: "flag-outline",
    id: "oceania",
    label: "Oceania",
  },
];

export function regionTypeForMapScope(mapScope: MapScope): RegionType {
  return mapScope === "canada" || mapScope === "mexico" || mapScope === "usa"
    ? "north-america"
    : "global";
}

export function regionSlugForScope(mapScope: MapScope): string {
  return mapScope === "global" ? "all" : mapScope;
}

export function mapScopeLabel(mapScope: MapScope): string {
  return mapScopes.find((scope) => scope.id === mapScope)?.label ?? "SoundKit";
}
