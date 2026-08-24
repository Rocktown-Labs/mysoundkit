import { describe, expect, it } from "vitest";

import {
  exploreLocationPhrase,
  exploreRegionQuery,
  isMapScope,
  mapScopeForDetectedLocation,
  resolveInitialExploreRegion,
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
    expect(
      exploreRegionQuery({ mapScope: "north-america", region: "Arkansas" })
    ).toEqual({ region: "arkansas", regionType: "north-america" });
    expect(exploreLocationPhrase({ mapScope: "global", region: null })).toBe(
      "On SoundKit"
    );
  });

  it("validates map scopes and maps detected countries", () => {
    expect(isMapScope("africa")).toBe(true);
    expect(isMapScope("middle-earth")).toBe(false);
    expect(mapScopeForDetectedLocation({ countryCode: "ca" })).toBe(
      "north-america"
    );
    expect(mapScopeForDetectedLocation({ countryCode: "NG" })).toBe("global");
  });
});
