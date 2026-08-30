import { describe, expect, it } from "vitest";

import {
  normalizeLocationComponents,
  parseManualLocation,
} from "./location-normalization";

describe("normalizeLocationComponents", () => {
  it("normalizes a US city to its state code and country", () => {
    expect(
      normalizeLocationComponents([
        { longText: "Little Rock", shortText: null, types: ["locality"] },
        {
          longText: "Arkansas",
          shortText: "AR",
          types: ["administrative_area_level_1"],
        },
        {
          longText: "United States",
          shortText: "US",
          types: ["country"],
        },
      ])
    ).toEqual({ city: "Little Rock", country: "United States", state: "AR" });
  });

  it("supports international cities and administrative regions", () => {
    expect(
      normalizeLocationComponents([
        { longText: "Beijing", shortText: null, types: ["locality"] },
        {
          longText: "Beijing",
          shortText: null,
          types: ["administrative_area_level_1"],
        },
        { longText: "China", shortText: "CN", types: ["country"] },
      ])
    ).toEqual({ city: "Beijing", country: "China", state: "Beijing" });
  });

  it("falls back to the country when no administrative region exists", () => {
    expect(
      normalizeLocationComponents([
        { longText: "Monaco", shortText: null, types: ["locality"] },
        { longText: "Monaco", shortText: "MC", types: ["country"] },
      ])
    ).toEqual({ city: "Monaco", country: "Monaco", state: "Monaco" });
  });

  it("rejects a selection without a city or country", () => {
    expect(
      normalizeLocationComponents([
        { longText: "France", shortText: "FR", types: ["country"] },
      ])
    ).toBeNull();
  });
});

describe("parseManualLocation", () => {
  it("recognizes the existing US city and state format", () => {
    expect(parseManualLocation("Little Rock, AR")).toEqual({
      city: "Little Rock",
      country: "United States",
      query: "Little Rock, AR",
      state: "AR",
    });
  });

  it("supports city, region, country input", () => {
    expect(parseManualLocation("Toronto, Ontario, Canada")).toEqual({
      city: "Toronto",
      country: "Canada",
      query: "Toronto, Ontario, Canada",
      state: "Ontario",
    });
  });

  it("normalizes a full US state name when the lookup is unavailable", () => {
    expect(parseManualLocation("Little Rock, Arkansas")).toEqual({
      city: "Little Rock",
      country: "United States",
      query: "Little Rock, Arkansas",
      state: "AR",
    });
  });
});
