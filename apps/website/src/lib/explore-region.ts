/* eslint-disable one-var, sort-vars, no-nested-ternary */
import { mapScopes } from "./map-scopes";
import type { MapScope } from "./map-scopes";
import { US_STATE_NAMES } from "./us-state-names";

export type ExploreRegionType = "global" | "north-america";

export interface ExploreRegionSearch {
  mapScope?: MapScope;
  region?: string;
  regionType?: ExploreRegionType;
  upgraded?: boolean;
}

export interface ExploreRegionSelection {
  mapScope: MapScope;
  region: string | null;
  regionType: ExploreRegionType;
}

const REGION_LABEL_PATTERN = /^[\p{L}\p{N} .,&'’()-]+$/u,
  MAX_REGION_LABEL_LENGTH = 120,
  normalizeRegionInput = (value: unknown): string | undefined => {
    if (typeof value !== "string") {
      return undefined;
    }
    const label = value.trim().slice(0, MAX_REGION_LABEL_LENGTH);
    return label && REGION_LABEL_PATTERN.test(label) ? label : undefined;
  },
  mapScopeIds = new Set<MapScope>(mapScopes.map((scope) => scope.id)),
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

const inferExploreRegionType = (
  region: string | null,
  scope?: MapScope
): ExploreRegionType => {
  if (scope) {
    return regionTypeForMapScope(scope);
  }
  if (
    region &&
    exploreRegionSlug(region) !== "all" &&
    !mapScopeFromValue(region)
  ) {
    return "north-america";
  }
  return "global";
};

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
  const region = normalizeRegionInput(search.region ?? savedRegion) ?? null,
    explicitScope =
      search.mapScope ?? mapScopeFromValue(savedMapScope) ?? undefined,
    regionType =
      search.regionType ??
      (savedRegionType === "global" || savedRegionType === "north-america"
        ? savedRegionType
        : undefined) ??
      inferExploreRegionType(region, explicitScope),
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

const REGION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export const formatExploreRegionDisplayName = (
  value: string | null | undefined,
  scope?: MapScope
): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = normalizeRegionInput(value);
  if (!trimmed) {
    return null;
  }

  if (scope === "usa") {
    const postalCode = trimmed.toUpperCase().replace(/^US-/u, "");
    const stateName = US_STATE_NAMES[postalCode];
    if (stateName) {
      return stateName;
    }
  }

  if (!REGION_SLUG_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const withoutCountryPrefix =
    scope === "usa" && trimmed.startsWith("us-") ? trimmed.slice(3) : trimmed;

  return withoutCountryPrefix
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
};

export const validateExploreSearch = (
  search: Record<string, unknown>
): ExploreRegionSearch => ({
  mapScope: mapScopeFromValue(search.mapScope),
  region: normalizeRegionInput(search.region),
  regionType:
    search.regionType === "global" || search.regionType === "north-america"
      ? search.regionType
      : undefined,
  upgraded:
    search.upgraded === "1" || search.upgraded === true ? true : undefined,
});

export const parseExploreGeocodeResponse = (
  value: unknown
): {
  countryCode: string;
  countryName: string;
  principalSubdivision?: string;
} => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("countryCode" in value) ||
    typeof value.countryCode !== "string" ||
    !("countryName" in value) ||
    typeof value.countryName !== "string"
  ) {
    throw new Error("Invalid reverse-geocode response shape.");
  }
  const principalSubdivision =
    "principalSubdivision" in value ? value.principalSubdivision : undefined;
  if (
    principalSubdivision !== undefined &&
    typeof principalSubdivision !== "string"
  ) {
    throw new Error("Invalid reverse-geocode subdivision.");
  }
  return {
    countryCode: value.countryCode,
    countryName: value.countryName,
    principalSubdivision,
  };
};
