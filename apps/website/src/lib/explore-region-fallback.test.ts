import { describe, expect, it } from "vitest";

import {
  exploreLocationPhrase,
  exploreRegionQuery,
  exploreRegionSlug,
  resolveInitialExploreRegion,
  withGlobalRegionFallback,
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

  it("falls back to global items when regional query returns empty array", async () => {
    const regionalFetch = async () => [];
    const globalFetch = async () => [{ id: "global-1", title: "Global Track" }];

    const result = await withGlobalRegionFallback(
      "virginia",
      regionalFetch,
      globalFetch
    );

    expect(result).toEqual([{ id: "global-1", title: "Global Track" }]);
  });

  it("preserves regional items when regional query has results", async () => {
    const regionalFetch = async () => [{ id: "local-1", title: "Local Track" }];
    const globalFetch = async () => [{ id: "global-1", title: "Global Track" }];

    const result = await withGlobalRegionFallback(
      "arkansas",
      regionalFetch,
      globalFetch
    );

    expect(result).toEqual([{ id: "local-1", title: "Local Track" }]);
  });
});
