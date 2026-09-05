/* eslint-disable one-var, sort-vars */

export type GeoScope = "all" | "state";
export type GeoTier = "local" | "national" | "neighbor";

export const GEO_BOOST_LOCAL = 0.08,
  GEO_BOOST_NEIGHBOR = 0.03;

const US_STATE_NAMES: Record<string, string> = {
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

/**
 * Accepts "TX", "tx", "Texas", "US-TX" (and DC variants). Profile states
 * are free text, so matching stays lenient. Pure — worker-tested.
 */
export const normalizeStateCode = (
  value: string | null | undefined
): string | null => {
  if (!value) {
    return null;
  }
  const cleaned = value.trim().toUpperCase().replace(/^US-/u, "");
  if (US_STATE_NAMES[cleaned]) {
    return cleaned;
  }
  const match = Object.entries(US_STATE_NAMES).find(
    ([, name]) => name.toUpperCase() === cleaned
  );
  return match ? match[0] : null;
};

export const stateDisplayName = (abbr: string): string =>
  US_STATE_NAMES[abbr] ?? abbr;

const NEIGHBOR_STATES: Record<string, string[]> = {
  AK: [],
  AL: ["FL", "GA", "MS", "TN"],
  AR: ["LA", "MO", "MS", "OK", "TN", "TX"],
  AZ: ["CA", "CO", "NM", "NV", "UT"],
  CA: ["AZ", "NV", "OR"],
  CO: ["KS", "NE", "NM", "OK", "UT", "WY"],
  CT: ["MA", "NY", "RI"],
  DC: ["MD", "VA"],
  DE: ["MD", "NJ", "PA"],
  FL: ["AL", "GA"],
  GA: ["AL", "FL", "NC", "SC", "TN"],
  HI: [],
  IA: ["IL", "MN", "MO", "NE", "SD", "WI"],
  ID: ["MT", "NV", "OR", "UT", "WA", "WY"],
  IL: ["IA", "IN", "KY", "MI", "MO", "WI"],
  IN: ["IL", "KY", "MI", "OH"],
  KS: ["CO", "MO", "NE", "OK"],
  KY: ["IL", "IN", "MO", "OH", "TN", "VA", "WV"],
  LA: ["AR", "MS", "TX"],
  MA: ["CT", "NH", "NY", "RI", "VT"],
  MD: ["DC", "DE", "PA", "VA", "WV"],
  ME: ["NH"],
  MI: ["IN", "OH", "WI"],
  MN: ["IA", "ND", "SD", "WI"],
  MO: ["AR", "IA", "IL", "KS", "KY", "NE", "OK", "TN"],
  MS: ["AL", "AR", "LA", "TN"],
  MT: ["ID", "ND", "SD", "WY"],
  NC: ["GA", "SC", "TN", "VA"],
  ND: ["MN", "MT", "SD"],
  NE: ["CO", "IA", "KS", "MO", "SD", "WY"],
  NH: ["MA", "ME", "VT"],
  NJ: ["DE", "NY", "PA"],
  NM: ["AZ", "CO", "OK", "TX", "UT"],
  NV: ["AZ", "CA", "ID", "OR", "UT"],
  NY: ["CT", "MA", "NJ", "PA", "VT"],
  OH: ["IN", "KY", "MI", "PA", "WV"],
  OK: ["AR", "CO", "KS", "MO", "NM", "TX"],
  OR: ["CA", "ID", "NV", "WA"],
  PA: ["DE", "MD", "NJ", "NY", "OH", "WV"],
  RI: ["CT", "MA"],
  SC: ["GA", "NC"],
  SD: ["IA", "MN", "MT", "ND", "NE", "WY"],
  TN: ["AL", "AR", "GA", "KY", "MO", "MS", "NC", "VA"],
  TX: ["AR", "LA", "NM", "OK"],
  UT: ["AZ", "CO", "ID", "NM", "NV", "WY"],
  VA: ["DC", "KY", "MD", "NC", "TN", "WV"],
  VT: ["MA", "NH", "NY"],
  WA: ["ID", "OR"],
  WI: ["IA", "IL", "MI", "MN"],
  WV: ["KY", "MD", "OH", "PA", "VA"],
  WY: ["CO", "ID", "MT", "NE", "SD", "UT"],
};

export const neighborStates = (abbr: string): string[] =>
  NEIGHBOR_STATES[abbr] ?? [];

export const tierOfResult = (
  resultState: string | null,
  scopeStates: string[]
): GeoTier => {
  const code = normalizeStateCode(resultState);
  if (!code || scopeStates.length === 0) {
    return "national";
  }
  if (scopeStates.includes(code)) {
    return "local";
  }
  const neighborSet = new Set(scopeStates.flatMap(neighborStates));
  return neighborSet.has(code) ? "neighbor" : "national";
};

export interface GeoScopedResult {
  geoTier: GeoTier;
  score: number;
  state: string | null;
}

const tierBoost = (tier: GeoTier): number => {
  if (tier === "local") {
    return GEO_BOOST_LOCAL;
  }
  return tier === "neighbor" ? GEO_BOOST_NEIGHBOR : 0;
};

/**
 * Concentric ranking: scope "state" hard-filters to in-state; scope "all"
 * boosts local/neighbor and re-sorts. Pure — worker-tested.
 */
export const applyGeoScope = <T extends GeoScopedResult>(
  results: T[],
  scope: GeoScope,
  scopeStates: string[]
): T[] => {
  const tiered = results.map((result) => ({
    result,
    tier: tierOfResult(result.state, scopeStates),
  }));
  if (scope === "state") {
    return tiered
      .filter((entry) => entry.tier === "local")
      .map((entry) => ({ ...entry.result, geoTier: entry.tier }));
  }
  return tiered
    .map((entry) => ({
      result: {
        ...entry.result,
        geoTier: entry.tier,
        score: Math.min(1, entry.result.score + tierBoost(entry.tier)),
      },
      sortKey: entry.result.score + tierBoost(entry.tier),
    }))
    .toSorted((a, b) => b.sortKey - a.sortKey)
    .map((entry) => entry.result);
};

export interface ParsedSearchQuery {
  entityTypes: ("artist" | "project" | "track" | "video")[];
  states: string[];
  vectorText: string;
}

const ENTITY_PATTERNS: {
    pattern: RegExp;
    type: "artist" | "project" | "track" | "video";
  }[] = [
    {
      pattern: /\b(?<entity>songs?|tracks?|tunes?|beats?|jams?)\b/iu,
      type: "track",
    },
    {
      pattern:
        /\b(?<entity>artists?|singers?|rappers?|musicians?|bands?|producers?)\b/iu,
      type: "artist",
    },
    {
      pattern: /\b(?<entity>videos?|clips?|visuals?)\b/iu,
      type: "video",
    },
    {
      pattern:
        /\b(?<entity>projects?|albums?|\beps?\b|mixtapes?|playlists?)\b/iu,
      type: "project",
    },
  ],
  GEO_CUE_PATTERN = /\b(?<cue>in|from|near|around|across|out of|outta)\b/iu,
  stateNamesByLength = Object.entries(US_STATE_NAMES).toSorted(
    ([, a], [, b]) => b.length - a.length
  );

/**
 * Deterministic NL parsing: extract states + entity intent, leaving the
 * vibe text for the vector. Abbreviations only count with a geo cue
 * ("in TX") or US- prefix to avoid false hits on words like OR/ME/HI.
 * Returns null when there is nothing to extract (raw-query path).
 * Pure — worker-tested.
 */
export const parseSearchQuery = (text: string): ParsedSearchQuery | null => {
  const states: string[] = [],
    entityTypes: ParsedSearchQuery["entityTypes"] = [];
  let cleaned = ` ${text} `;

  for (const [abbr, name] of stateNamesByLength) {
    const pattern = new RegExp(`\\b${name.replaceAll(" ", "\\s+")}\\b`, "iu");
    if (pattern.test(cleaned)) {
      states.push(abbr);
      cleaned = cleaned.replace(pattern, " ");
    }
  }

  const hasGeoCue = GEO_CUE_PATTERN.test(cleaned);
  for (const abbr of Object.keys(US_STATE_NAMES)) {
    if (states.includes(abbr)) {
      continue;
    }
    const usPrefixed = new RegExp(`\\bUS-${abbr}\\b`, "iu");
    if (usPrefixed.test(cleaned)) {
      states.push(abbr);
      cleaned = cleaned.replace(usPrefixed, " ");
      continue;
    }
    if (hasGeoCue && new RegExp(`\\b${abbr}\\b`).test(cleaned)) {
      states.push(abbr);
      cleaned = cleaned.replace(new RegExp(`\\b${abbr}\\b`), " ");
    }
  }

  for (const { pattern, type } of ENTITY_PATTERNS) {
    if (pattern.test(cleaned)) {
      entityTypes.push(type);
      cleaned = cleaned.replace(pattern, " ");
    }
  }

  if (states.length === 0 && entityTypes.length === 0) {
    return null;
  }
  if (states.length > 0) {
    cleaned = cleaned.replaceAll(new RegExp(GEO_CUE_PATTERN, "giu"), " ");
  }
  const vectorText = cleaned.replaceAll(/\s+/gu, " ").trim();
  return {
    entityTypes: [...new Set(entityTypes)],
    states: [...new Set(states)],
    vectorText: vectorText || text.trim(),
  };
};

/**
 * Implicit scope from CDN region headers (same sources as ads
 * requestTargets). Boost-only signal, never a filter.
 */
export const implicitScopeFromHeaders = (headers: Headers): string[] => {
  const region =
    headers.get("cf-region-code") ??
    headers.get("x-vercel-ip-country-region") ??
    headers.get("x-region-code") ??
    "";
  const code = normalizeStateCode(region);
  return code ? [code] : [];
};
