import { describe, expect, it } from "vitest";

import {
  exploreLocationPhrase,
  exploreRegionQuery,
  exploreRegionSlug,
  resolveInitialExploreRegion,
} from "./explore-region";

describe("Regional empty-state & fallback behavior", () => {
  it("defaults to global scope when no saved or search region is provided", () => {
    const selection = resolveInitialExploreRegion({
      savedMapScope: null,
      savedRegion: null,
      savedRegionType: null,
      search: {},
    });

    expect(selection).toEqual({
      mapScope: "global",
      region: null,
      regionType: "global",
    });
  });

  it("formats location phrases correctly for global and regional views", () => {
    expect(
      exploreLocationPhrase({
        mapScope: "global",
        region: null,
      })
    ).toBe("On SoundKit");

    expect(
      exploreLocationPhrase({
        mapScope: "usa",
        region: "Virginia",
      })
    ).toBe("in Virginia");
  });

  it("formats region slugs correctly for state names", () => {
    expect(exploreRegionSlug("Virginia")).toBe("virginia");
    expect(exploreRegionSlug("North Carolina")).toBe("north-carolina");
  });

  it("correctly determines explore queries for regional search", () => {
    expect(
      exploreRegionQuery({
        mapScope: "usa",
        region: "Virginia",
      })
    ).toEqual({
      region: "virginia",
      regionType: "north-america",
    });

    expect(
      exploreRegionQuery({
        mapScope: "global",
        region: null,
      })
    ).toEqual({
      region: "all",
      regionType: "global",
    });
  });
});
