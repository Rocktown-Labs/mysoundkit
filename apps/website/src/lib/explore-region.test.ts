import { describe, expect, it } from "vitest";

import {
  exploreLocationPhrase,
  exploreRegionQuery,
  formatExploreRegionDisplayName,
  isMapScope,
  mapScopeForDetectedLocation,
  mapScopeFromValue,
  parseExploreGeocodeResponse,
  resolveInitialExploreRegion,
  validateExploreSearch,
} from "./explore-region";

describe("Explore region state", () => {
  it("prefers a valid URL selection over saved preferences", () => {
    expect(
      resolveInitialExploreRegion({
        savedMapScope: "north-america",
        savedRegion: "us-arkansas",
        savedRegionType: "north-america",
        search: {
          mapScope: "africa",
          region: "Nigeria",
          regionType: "global",
        },
      })
    ).toEqual({
      mapScope: "africa",
      region: "Nigeria",
      regionType: "global",
    });
  });

  it("restores a continent scope without treating it as a country", () => {
    expect(
      resolveInitialExploreRegion({
        savedMapScope: "africa",
        savedRegion: "africa",
        savedRegionType: "global",
        search: {},
      })
    ).toEqual({ mapScope: "africa", region: null, regionType: "global" });
  });

  it("builds platform-wide and regional API queries", () => {
    expect(exploreRegionQuery({ mapScope: "global", region: null })).toEqual({
      region: "all",
      regionType: "global",
    });
    expect(exploreRegionQuery({ mapScope: "usa", region: "Arkansas" })).toEqual(
      { region: "arkansas", regionType: "north-america" }
    );
    expect(exploreLocationPhrase({ mapScope: "global", region: null })).toBe(
      "On SoundKit"
    );
  });

  it("validates map scopes and maps detected countries", () => {
    expect(isMapScope("africa")).toBe(true);
    expect(isMapScope("middle-earth")).toBe(false);
    expect(mapScopeForDetectedLocation({ countryCode: "ca" })).toBe("canada");
    expect(mapScopeForDetectedLocation({ countryCode: "mx" })).toBe("mexico");
    expect(mapScopeForDetectedLocation({ countryCode: "us" })).toBe("usa");
    expect(mapScopeForDetectedLocation({ countryCode: "NG" })).toBe("global");
    expect(mapScopeFromValue("north-america")).toBe("usa");
    expect(mapScopeFromValue("middle-earth")).toBeUndefined();
  });

  it("omits upgraded from search when absent and preserves upgraded=1", () => {
    expect(validateExploreSearch({})).toEqual({
      mapScope: undefined,
      region: undefined,
      regionType: undefined,
      upgraded: undefined,
    });
    expect(
      validateExploreSearch({ upgraded: "false" }).upgraded
    ).toBeUndefined();
    expect(validateExploreSearch({ upgraded: "1" }).upgraded).toBe(true);
    expect(validateExploreSearch({ upgraded: true }).upgraded).toBe(true);
  });

  it("formats region slugs into readable display labels without altering labels", () => {
    expect(formatExploreRegionDisplayName("new-york")).toBe("New York");
    expect(formatExploreRegionDisplayName("us-ca", "usa")).toBe("California");
    expect(formatExploreRegionDisplayName("US-DC", "usa")).toBe(
      "District of Columbia"
    );
    expect(formatExploreRegionDisplayName("AR", "usa")).toBe("Arkansas");
    expect(formatExploreRegionDisplayName("us-california", "usa")).toBe(
      "California"
    );
    expect(formatExploreRegionDisplayName("New York")).toBe("New York");
    expect(formatExploreRegionDisplayName("Washington, D.C.")).toBe(
      "Washington, D.C."
    );
    expect(formatExploreRegionDisplayName("")).toBeNull();
  });
  it("bounds region labels and rejects markup without losing geographic display names", () => {
    expect(validateExploreSearch({ region: "  New York  " }).region).toBe(
      "New York"
    );
    expect(
      validateExploreSearch({ region: "a".repeat(200) }).region
    ).toHaveLength(120);
    expect(
      validateExploreSearch({ region: "<script>" }).region
    ).toBeUndefined();
    expect(formatExploreRegionDisplayName("<script>")).toBeNull();
    expect(formatExploreRegionDisplayName("us-river")).toBe("Us River");
    expect(formatExploreRegionDisplayName("us-river", "europe")).toBe(
      "Us River"
    );
  });

  it("infers a regional selection when legacy preferences lack scope metadata", () => {
    expect(
      resolveInitialExploreRegion({ savedRegion: "us-arkansas", search: {} })
    ).toMatchObject({ mapScope: "usa", regionType: "north-america" });
    expect(
      resolveInitialExploreRegion({ savedRegion: "europe", search: {} })
    ).toMatchObject({ mapScope: "europe", region: null, regionType: "global" });
  });
  it("validates reverse-geocode payloads before reading region fields", () => {
    expect(
      parseExploreGeocodeResponse({
        countryCode: "US",
        countryName: "United States",
        principalSubdivision: "Arkansas",
      }).principalSubdivision
    ).toBe("Arkansas");
    for (const payload of [
      null,
      [],
      "US",
      { countryCode: 4 },
      {
        countryCode: "US",
        countryName: "United States",
        principalSubdivision: {},
      },
    ]) {
      expect(() => parseExploreGeocodeResponse(payload)).toThrow();
    }
  });
});
