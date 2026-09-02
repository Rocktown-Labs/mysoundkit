/* oxlint-disable one-var, sort-vars */

export interface LocationAddressComponent {
  longText?: string | null;
  shortText?: string | null;
  types: readonly string[];
}

export interface NormalizedLocation {
  city: string;
  country: string;
  state: string;
}

const US_STATE_CODES = new Set([
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
  ]),
  US_STATE_NAMES: Readonly<Record<string, string>> = {
    alabama: "AL",
    alaska: "AK",
    arizona: "AZ",
    arkansas: "AR",
    california: "CA",
    colorado: "CO",
    connecticut: "CT",
    delaware: "DE",
    florida: "FL",
    georgia: "GA",
    hawaii: "HI",
    idaho: "ID",
    illinois: "IL",
    indiana: "IN",
    iowa: "IA",
    kansas: "KS",
    kentucky: "KY",
    louisiana: "LA",
    maine: "ME",
    maryland: "MD",
    massachusetts: "MA",
    michigan: "MI",
    minnesota: "MN",
    mississippi: "MS",
    missouri: "MO",
    montana: "MT",
    nebraska: "NE",
    nevada: "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    ohio: "OH",
    oklahoma: "OK",
    oregon: "OR",
    pennsylvania: "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    tennessee: "TN",
    texas: "TX",
    utah: "UT",
    vermont: "VT",
    virginia: "VA",
    washington: "WA",
    "west virginia": "WV",
    wisconsin: "WI",
    wyoming: "WY",
  },
  firstComponent = (
    components: readonly LocationAddressComponent[],
    types: readonly string[]
  ) => {
    for (const type of types) {
      const component = components.find((item) => item.types.includes(type)),
        value = component?.shortText?.trim() || component?.longText?.trim();
      if (value) {
        return value;
      }
    }
    return "";
  };

export const normalizeLocationComponents = (
  components: readonly LocationAddressComponent[]
): NormalizedLocation | null => {
  const countryComponent = components.find((item) =>
      item.types.includes("country")
    ),
    country =
      countryComponent?.longText?.trim() ||
      countryComponent?.shortText?.trim() ||
      "",
    city = firstComponent(components, [
      "locality",
      "postal_town",
      "administrative_area_level_2",
    ]);

  if (!(city && country)) {
    return null;
  }

  return {
    city,
    country,
    state:
      firstComponent(components, [
        "administrative_area_level_1",
        "administrative_area_level_2",
      ]) || country,
  };
};

export const isLocationSelectionUnchanged = (
  query: string,
  selectedLabel: string
) => Boolean(selectedLabel && query.trim() === selectedLabel.trim());

export const parseManualLocation = (
  value: string
): (NormalizedLocation & { query: string }) | null => {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  const [city, stateOrCountry, countryPart] = parts,
    stateKey = stateOrCountry.toLowerCase(),
    stateCode = US_STATE_NAMES[stateKey],
    normalizedState =
      stateCode ??
      (US_STATE_CODES.has(stateOrCountry.toUpperCase())
        ? stateOrCountry.toUpperCase()
        : stateOrCountry),
    isUsState = Boolean(stateCode) || US_STATE_CODES.has(normalizedState),
    country = countryPart || (isUsState ? "United States" : stateOrCountry);

  return city && stateOrCountry
    ? {
        city,
        country,
        query: value.trim(),
        state: normalizedState,
      }
    : null;
};
