/* eslint-disable one-var, sort-vars */
import { userProfiles } from "@soundkit/db/schema/app";
import { and, inArray, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { exploreCountries } from "@/lib/country-regions";
import type { ExploreContinent } from "@/lib/country-regions";
import { canonicalGenreSlug } from "@/lib/genre-catalog";

const northAmericaStates = {
    "us-alabama": { abbreviation: "AL", name: "Alabama" },
    "us-alaska": { abbreviation: "AK", name: "Alaska" },
    "us-arizona": { abbreviation: "AZ", name: "Arizona" },
    "us-arkansas": { abbreviation: "AR", name: "Arkansas" },
    "us-california": { abbreviation: "CA", name: "California" },
    "us-colorado": { abbreviation: "CO", name: "Colorado" },
    "us-connecticut": { abbreviation: "CT", name: "Connecticut" },
    "us-delaware": { abbreviation: "DE", name: "Delaware" },
    "us-florida": { abbreviation: "FL", name: "Florida" },
    "us-georgia": { abbreviation: "GA", name: "Georgia" },
    "us-hawaii": { abbreviation: "HI", name: "Hawaii" },
    "us-idaho": { abbreviation: "ID", name: "Idaho" },
    "us-illinois": { abbreviation: "IL", name: "Illinois" },
    "us-indiana": { abbreviation: "IN", name: "Indiana" },
    "us-iowa": { abbreviation: "IA", name: "Iowa" },
    "us-kansas": { abbreviation: "KS", name: "Kansas" },
    "us-kentucky": { abbreviation: "KY", name: "Kentucky" },
    "us-louisiana": { abbreviation: "LA", name: "Louisiana" },
    "us-maine": { abbreviation: "ME", name: "Maine" },
    "us-maryland": { abbreviation: "MD", name: "Maryland" },
    "us-massachusetts": { abbreviation: "MA", name: "Massachusetts" },
    "us-michigan": { abbreviation: "MI", name: "Michigan" },
    "us-minnesota": { abbreviation: "MN", name: "Minnesota" },
    "us-mississippi": { abbreviation: "MS", name: "Mississippi" },
    "us-missouri": { abbreviation: "MO", name: "Missouri" },
    "us-montana": { abbreviation: "MT", name: "Montana" },
    "us-nebraska": { abbreviation: "NE", name: "Nebraska" },
    "us-nevada": { abbreviation: "NV", name: "Nevada" },
    "us-new-hampshire": { abbreviation: "NH", name: "New Hampshire" },
    "us-new-jersey": { abbreviation: "NJ", name: "New Jersey" },
    "us-new-mexico": { abbreviation: "NM", name: "New Mexico" },
    "us-new-york": { abbreviation: "NY", name: "New York" },
    "us-north-carolina": { abbreviation: "NC", name: "North Carolina" },
    "us-north-dakota": { abbreviation: "ND", name: "North Dakota" },
    "us-ohio": { abbreviation: "OH", name: "Ohio" },
    "us-oklahoma": { abbreviation: "OK", name: "Oklahoma" },
    "us-oregon": { abbreviation: "OR", name: "Oregon" },
    "us-pennsylvania": { abbreviation: "PA", name: "Pennsylvania" },
    "us-rhode-island": { abbreviation: "RI", name: "Rhode Island" },
    "us-south-carolina": { abbreviation: "SC", name: "South Carolina" },
    "us-south-dakota": { abbreviation: "SD", name: "South Dakota" },
    "us-tennessee": { abbreviation: "TN", name: "Tennessee" },
    "us-texas": { abbreviation: "TX", name: "Texas" },
    "us-utah": { abbreviation: "UT", name: "Utah" },
    "us-vermont": { abbreviation: "VT", name: "Vermont" },
    "us-virginia": { abbreviation: "VA", name: "Virginia" },
    "us-washington": { abbreviation: "WA", name: "Washington" },
    "us-west-virginia": { abbreviation: "WV", name: "West Virginia" },
    "us-wisconsin": { abbreviation: "WI", name: "Wisconsin" },
    "us-wyoming": { abbreviation: "WY", name: "Wyoming" },
  } as const,
  continentAliases: Readonly<Record<string, ExploreContinent>> = {
    africa: "africa",
    asia: "asia",
    australia: "oceania",
    europe: "europe",
    "latin-america": "latin-america",
    "north-america": "north-america",
    oceania: "oceania",
    "south-america": "latin-america",
    usa: "north-america",
  },
  normalizeRegion = (value: string): string =>
    value
      .normalize("NFKD")
      .replaceAll(/[\u0300-\u036F]/gu, "")
      .trim()
      .toLowerCase()
      .replaceAll("&", "and")
      .replaceAll(/[^a-z0-9]+/gu, "-")
      .replaceAll(/^-|-$/gu, ""),
  normalizedCountryValue = sql<string>`lower(coalesce(${userProfiles.country}, ''))`,
  normalizedStateValue = sql<string>`lower(trim(coalesce(${userProfiles.state}, '')))`,
  unitedStatesStateAliases = Object.values(northAmericaStates).flatMap(
    (state) => [state.abbreviation.toLowerCase(), state.name.toLowerCase()]
  ),
  inferredUnitedStatesCondition = and(
    sql`trim(coalesce(${userProfiles.country}, '')) = ''`,
    inArray(normalizedStateValue, unitedStatesStateAliases)
  );

export type ExploreRegionQuery = Readonly<{
  region?: string;
  regionType?: string;
}>;

export type ResolvedExploreRegion =
  | { kind: "continent"; scope: ExploreContinent }
  | { aliases: readonly string[]; kind: "country"; name: string }
  | { kind: "global" }
  | { abbreviation: string; kind: "state"; name: string }
  | { kind: "unknown" };

export const genreSlugFromExploreFilter = (genre: string | undefined) =>
  genre && genre !== "all" ? canonicalGenreSlug(genre) : null;

export const stateFromExploreRegion = ({
  region,
  regionType,
}: ExploreRegionQuery) => {
  if (!region || regionType === "global") {
    return null;
  }

  const direct = northAmericaStates[region as keyof typeof northAmericaStates];
  if (direct) {
    return direct;
  }

  const normalized = normalizeRegion(region).replace(/^us-/u, "");
  for (const [key, value] of Object.entries(northAmericaStates)) {
    if (
      key.replace(/^us-/u, "") === normalized ||
      value.abbreviation.toLowerCase() === normalized ||
      normalizeRegion(value.name) === normalized
    ) {
      return value;
    }
  }

  return null;
};

export const resolveExploreRegion = (
  query: ExploreRegionQuery
): ResolvedExploreRegion => {
  const region = query.region?.trim();
  if (!region || region === "global") {
    return query.regionType === "north-america"
      ? { kind: "continent", scope: "north-america" }
      : { kind: "global" };
  }

  const normalized = normalizeRegion(region);
  if (normalized === "all") {
    return query.regionType === "north-america"
      ? { kind: "continent", scope: "north-america" }
      : { kind: "global" };
  }

  const state = stateFromExploreRegion(query);
  if (state) {
    return { ...state, kind: "state" };
  }

  const continent = continentAliases[normalized];
  if (continent) {
    return { kind: "continent", scope: continent };
  }

  const country = exploreCountries.find(
    (entry) =>
      entry.slug === normalized ||
      entry.aliases.some((alias) => normalizeRegion(alias) === normalized)
  );
  if (country) {
    return {
      aliases: country.aliases,
      kind: "country",
      name: country.name,
    };
  }

  return { kind: "unknown" };
};

export const profileRegionCondition = (
  query: ExploreRegionQuery
): SQL | undefined => {
  const resolved = resolveExploreRegion(query);

  if (resolved.kind === "global") {
    return undefined;
  }
  if (resolved.kind === "unknown") {
    return sql`false`;
  }
  if (resolved.kind === "state") {
    return sql`lower(coalesce(${userProfiles.state}, '')) in (${resolved.name.toLowerCase()}, ${resolved.abbreviation.toLowerCase()})`;
  }
  if (resolved.kind === "country") {
    const countryCondition = inArray(normalizedCountryValue, [
      ...resolved.aliases,
    ]);
    return resolved.name === "United States"
      ? or(countryCondition, inferredUnitedStatesCondition)
      : countryCondition;
  }

  const aliases = exploreCountries
      .filter((country) => country.scope === resolved.scope)
      .flatMap((country) => country.aliases),
    continentCondition =
      aliases.length > 0
        ? inArray(normalizedCountryValue, [...new Set(aliases)])
        : sql`false`;
  return resolved.scope === "north-america"
    ? or(continentCondition, inferredUnitedStatesCondition)
    : continentCondition;
};

const regionEntryByStateValue = (state?: string | null) => {
  if (!state) {
    return null;
  }

  const normalized = state.trim().toLowerCase();
  return (
    Object.values(northAmericaStates).find(
      (value) =>
        value.abbreviation.toLowerCase() === normalized ||
        value.name.toLowerCase() === normalized
    ) ?? null
  );
};

export const countryFromProfileLocation = (
  country?: string | null,
  state?: string | null
): string => {
  const explicitCountry = country?.trim();
  if (explicitCountry) {
    return explicitCountry;
  }
  return regionEntryByStateValue(state) ? "United States" : "Unknown";
};

/** Maps a user profile state value ("AR", "Arkansas") to "us-ar". */
export const regionSlugFromUser = (state?: string | null) => {
  const entry = regionEntryByStateValue(state);
  return entry ? `us-${entry.abbreviation.toLowerCase()}` : null;
};
