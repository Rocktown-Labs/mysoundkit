/* eslint-disable one-var, sort-vars, no-nested-ternary */
export type MapScope =
  | "global"
  | "usa"
  | "canada"
  | "mexico"
  | "africa"
  | "europe"
  | "asia"
  | "latin-america"
  | "oceania";

export type ExploreRegionType = "global" | "north-america";

export interface ExploreRegionSelection {
  mapScope: MapScope;
  region: string | null;
  regionType: ExploreRegionType;
}

const MAP_SCOPE_IDS = new Set<string>([
    "global",
    "usa",
    "canada",
    "mexico",
    "africa",
    "europe",
    "asia",
    "latin-america",
    "oceania",
  ]),
  LEGACY_ALIASES: Readonly<Record<string, MapScope>> = {
    "north-america": "usa",
  };

export const mapScopeFromValue = (value: unknown): MapScope | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  return (
    LEGACY_ALIASES[value] ??
    (MAP_SCOPE_IDS.has(value) ? (value as MapScope) : undefined)
  );
};

export const exploreRegionSlug = (value: string): string =>
  value
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036F]/gu, "")
    .trim()
    .toLowerCase()
    .replaceAll("&", "and")
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");

export const regionTypeForMapScope = (mapScope: MapScope): ExploreRegionType =>
  mapScope === "usa" || mapScope === "canada" || mapScope === "mexico"
    ? "north-america"
    : "global";

const SCOPE_LABELS: Readonly<Record<MapScope, string>> = {
  africa: "Africa",
  asia: "Asia",
  canada: "Canada",
  europe: "Europe",
  global: "Global",
  "latin-america": "Latin America",
  mexico: "Mexico",
  oceania: "Oceania",
  usa: "USA",
};

export const mapScopeLabel = (mapScope: MapScope): string =>
  SCOPE_LABELS[mapScope] ?? "SoundKit";

export const exploreRegionQuery = ({
  mapScope,
  region,
}: Pick<ExploreRegionSelection, "mapScope" | "region">) => ({
  region: region == null ? regionForScope(mapScope) : exploreRegionSlug(region),
  regionType: regionTypeForMapScope(mapScope),
});

const regionForScope = (mapScope: MapScope): string =>
  mapScope === "global" ? "all" : mapScope;

export const exploreRegionLabel = ({
  mapScope,
  region,
}: Pick<ExploreRegionSelection, "mapScope" | "region">): string =>
  region ?? (mapScope === "global" ? "SoundKit" : mapScopeLabel(mapScope));

export const exploreLocationPhrase = (
  selection: Pick<ExploreRegionSelection, "mapScope" | "region">
): string =>
  selection.mapScope === "global" && !selection.region
    ? "On SoundKit"
    : `in ${exploreRegionLabel(selection)}`;
