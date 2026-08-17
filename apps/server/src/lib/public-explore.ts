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
} as const;

export const genreSlugFromExploreFilter = (genre: string | undefined) =>
  genre && genre !== "all" ? canonicalGenreSlug(genre) : null;

export const stateFromExploreRegion = ({
  region,
  regionType,
}: {
  region?: string;
  regionType?: string;
}) => {
  if (regionType !== "north-america" || !region || region === "all") {
    return null;
  }

  return northAmericaStates[region as keyof typeof northAmericaStates] ?? null;
};

const regionEntryByStateValue = (state?: string | null) => {
  if (!state) {
    return null;
  }

  const normalized = state.trim().toLowerCase(),
    entry = (
      Object.entries(northAmericaStates) as [
        string,
        {
          abbreviation: string;
          name: string;
        },
      ][]
    ).find(
      ([, value]) =>
        value.abbreviation.toLowerCase() === normalized ||
        value.name.toLowerCase() === normalized
    );

  return entry?.[1] ?? null;
};

/**
 * Maps a user profile state value ("AR", "Arkansas") to a compact region slug
 * for public URLs, e.g. "us-ar".
 */
export const regionSlugFromUser = (state?: string | null) => {
  const entry = regionEntryByStateValue(state);

  return entry ? `us-${entry.abbreviation.toLowerCase()}` : null;
};
