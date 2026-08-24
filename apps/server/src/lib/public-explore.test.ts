import { describe, expect, it } from "vitest";

import { resolveExploreRegion, stateFromExploreRegion } from "./public-explore";

describe("public Explore region resolution", () => {
  it("treats global all as the whole platform", () => {
    expect(
      resolveExploreRegion({ region: "all", regionType: "global" })
    ).toEqual({ kind: "global" });
  });

  it("resolves every visible region category to a real filter", () => {
    expect(
      resolveExploreRegion({ region: "africa", regionType: "global" })
    ).toEqual({ kind: "continent", scope: "africa" });
    expect(
      resolveExploreRegion({ region: "south-america", regionType: "global" })
    ).toEqual({ kind: "continent", scope: "latin-america" });
    expect(
      resolveExploreRegion({ region: "Canada", regionType: "north-america" })
    ).toMatchObject({ kind: "country", name: "Canada" });
    expect(
      resolveExploreRegion({ region: "Nigeria", regionType: "global" })
    ).toMatchObject({ kind: "country", name: "Nigeria" });
  });

  it("supports state names, abbreviations, and URL slugs", () => {
    expect(
      stateFromExploreRegion({
        region: "us-arkansas",
        regionType: "north-america",
      })
    ).toEqual({ abbreviation: "AR", name: "Arkansas" });
    expect(
      stateFromExploreRegion({ region: "AR", regionType: "north-america" })
    ).toEqual({ abbreviation: "AR", name: "Arkansas" });
  });

  it("does not silently turn unsupported regions into global results", () => {
    expect(
      resolveExploreRegion({ region: "middle-earth", regionType: "global" })
    ).toEqual({ kind: "unknown" });
  });
});
