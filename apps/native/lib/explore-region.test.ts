/* eslint-disable one-var */
import { describe, expect, it } from "vitest";

import { exploreRegionQuery, mapScopeFromValue } from "./explore-region";

describe("exploreRegionQuery", () => {
  it("queries the picked country, not its whole continent", () => {
    expect(
      exploreRegionQuery({ mapScope: "europe", region: "France" })
    ).toEqual({ region: "france", regionType: "global" });
    expect(
      exploreRegionQuery({ mapScope: "europe", region: "United Kingdom" })
    ).toEqual({ region: "united-kingdom", regionType: "global" });
    expect(exploreRegionQuery({ mapScope: "asia", region: "Japan" })).toEqual({
      region: "japan",
      regionType: "global",
    });
  });

  it("queries a US state slug with the north-america region type", () => {
    expect(exploreRegionQuery({ mapScope: "usa", region: "Arkansas" })).toEqual(
      { region: "arkansas", regionType: "north-america" }
    );
  });

  it("falls back to the scope slug when no country is picked", () => {
    expect(exploreRegionQuery({ mapScope: "europe", region: null })).toEqual({
      region: "europe",
      regionType: "global",
    });
  });

  it("maps the global scope to the all-region query", () => {
    expect(exploreRegionQuery({ mapScope: "global", region: null })).toEqual({
      region: "all",
      regionType: "global",
    });
  });

  it("uses the north-america region type for Canada and Mexico scopes", () => {
    expect(exploreRegionQuery({ mapScope: "canada", region: null })).toEqual({
      region: "canada",
      regionType: "north-america",
    });
    expect(exploreRegionQuery({ mapScope: "mexico", region: null })).toEqual({
      region: "mexico",
      regionType: "north-america",
    });
  });
});

describe("mapScopeFromValue", () => {
  it("parses stored scope values and rejects unknown ones", () => {
    expect(mapScopeFromValue("europe")).toBe("europe");
    expect(mapScopeFromValue("latin-america")).toBe("latin-america");
    expect(mapScopeFromValue("north-america")).toBe("usa");
    expect(mapScopeFromValue("bogus")).toBeUndefined();
    expect(mapScopeFromValue(42)).toBeUndefined();
  });
});
