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

const mapScopeIds = new Set<MapScope>(mapScopes.map((scope) => scope.id)),
  legacyMapScopeAliases: Readonly<Record<string, MapScope>> = {
    "north-america": "usa",
  };

export const mapScopeFromValue = (value: unknown): MapScope | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  return (
    legacyMapScopeAliases[value] ??
    (mapScopeIds.has(value as MapScope) ? (value as MapScope) : undefined)
  );
};

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
  mapScope === "north-america" ||
  mapScope === "usa" ||
  mapScope === "canada" ||
  mapScope === "mexico"
    ? "north-america"
    : "global";

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
      search.mapScope ?? mapScopeFromValue(savedMapScope) ?? undefined,
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
        ? "usa"
        : (mapScopeFromValue(normalizedRegion) ?? "global")),
    isScopeOnlySelection =
      normalizedRegion === "all" ||
      mapScopeFromValue(normalizedRegion) === inferredScope;

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
  if (normalizedCode === "US") {
    return "usa";
  }
  if (normalizedCode === "CA") {
    return "canada";
  }
  if (normalizedCode === "MX") {
    return "mexico";
  }
  return "global";
};

/**
 * If a regional catalog query returns no items, fall back to the global
 * catalog (`region: "all", regionType: "global"`) so screens never render empty
 * when a region has no releases yet.
 */
export async function withGlobalRegionFallback<T>(
  region: string | undefined,
  fetchRegional: () => Promise<T[]>,
  fetchGlobal: () => Promise<T[]>
): Promise<T[]> {
  const items = await fetchRegional();
  if (items.length === 0 && region !== undefined && region !== "all") {
    if (
      typeof window !== "undefined" &&
      typeof (
        window as unknown as {
          traks?: (
            name: string,
            props?: Record<string, string | number | boolean>
          ) => void;
        }
      ).traks === "function"
    ) {
      (
        window as unknown as {
          traks?: (
            name: string,
            props?: Record<string, string | number | boolean>
          ) => void;
        }
      ).traks?.("region_fallback_served", {
        requested_region: region,
      });
    }
    return fetchGlobal();
  }
  return items;
}
