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

export const US_STATE_CODE_TO_NAME: Readonly<Record<string, string>> = {
  AK: "Alaska",
  AL: "Alabama",
  AR: "Arkansas",
  AZ: "Arizona",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DC: "District of Columbia",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  IA: "Iowa",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  MA: "Massachusetts",
  MD: "Maryland",
  ME: "Maine",
  MI: "Michigan",
  MN: "Minnesota",
  MO: "Missouri",
  MS: "Mississippi",
  MT: "Montana",
  NC: "North Carolina",
  ND: "North Dakota",
  NE: "Nebraska",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NV: "Nevada",
  NY: "New York",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VA: "Virginia",
  VT: "Vermont",
  WA: "Washington",
  WI: "Wisconsin",
  WV: "West Virginia",
  WY: "Wyoming",
};

export const US_STATE_NAME_TO_CODE: Readonly<Record<string, string>> =
  Object.fromEntries(
    Object.entries(US_STATE_CODE_TO_NAME).map(([code, name]) => [
      name.toLowerCase(),
      code,
    ])
  );
