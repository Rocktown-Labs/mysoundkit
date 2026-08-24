/* eslint-disable one-var, sort-vars, no-nested-ternary */
import { mapScopes } from "./map-scopes";
import type { MapScope } from "./map-scopes";

export type ExploreRegionType = "global" | "north-america";

export interface ExploreRegionSearch {
  mapScope?: MapScope;
  region?: string;
  regionType?: ExploreRegionType;
}

export interface ExploreRegionSelection {
  mapScope: MapScope;
  region: string | null;
  regionType: ExploreRegionType;
}

const mapScopeIds = new Set<MapScope>(mapScopes.map((scope) => scope.id));

export const isMapScope = (value: unknown): value is MapScope =>
  typeof value === "string" && mapScopeIds.has(value as MapScope);

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
  mapScope === "north-america" ? "north-america" : "global";

export const mapScopeLabel = (mapScope: MapScope): string =>
  mapScopes.find((scope) => scope.id === mapScope)?.label ?? "SoundKit";

export const resolveInitialExploreRegion = ({
  savedMapScope,
  savedRegion,
  savedRegionType,
  search,
}: {
  savedMapScope?: string | null;
  savedRegion?: string | null;
  savedRegionType?: string | null;
  search: ExploreRegionSearch;
}): ExploreRegionSelection => {
  const region = search.region ?? savedRegion ?? null,
    explicitScope =
      search.mapScope ??
      (isMapScope(savedMapScope) ? savedMapScope : undefined),
    regionType =
      search.regionType ??
      (savedRegionType === "global" || savedRegionType === "north-america"
        ? savedRegionType
        : undefined) ??
      (explicitScope ? regionTypeForMapScope(explicitScope) : "global"),
    normalizedRegion = region ? exploreRegionSlug(region) : "all",
    inferredScope =
      explicitScope ??
      (regionType === "north-america"
        ? "north-america"
        : isMapScope(normalizedRegion)
          ? normalizedRegion
          : "global"),
    isScopeOnlySelection =
      normalizedRegion === "all" || normalizedRegion === inferredScope;

  return {
    mapScope: inferredScope,
    region: isScopeOnlySelection ? null : region,
    regionType: regionTypeForMapScope(inferredScope),
  };
};

export const exploreRegionQuery = ({
  mapScope,
  region,
}: Pick<ExploreRegionSelection, "mapScope" | "region">) => ({
  region: region
    ? exploreRegionSlug(region)
    : mapScope === "global"
      ? "all"
      : mapScope,
  regionType: regionTypeForMapScope(mapScope),
});

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

export const mapScopeForDetectedLocation = ({
  countryCode,
}: {
  countryCode?: string | null;
}): MapScope => {
  const normalizedCode = countryCode?.trim().toUpperCase();
  return normalizedCode === "US" ||
    normalizedCode === "CA" ||
    normalizedCode === "MX"
    ? "north-america"
    : "global";
};
