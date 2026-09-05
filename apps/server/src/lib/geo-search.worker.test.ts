/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { describe, expect, it } from "vitest";

import {
  applyGeoScope,
  implicitScopeFromHeaders,
  neighborStates,
  normalizeStateCode,
  parseSearchQuery,
  tierOfResult,
} from "./geo-search";

describe("normalizeStateCode", () => {
  it("accepts abbreviations, names, and US- prefixes", () => {
    expect(normalizeStateCode("TX")).toBe("TX");
    expect(normalizeStateCode("tx")).toBe("TX");
    expect(normalizeStateCode("Texas")).toBe("TX");
    expect(normalizeStateCode("US-TX")).toBe("TX");
    expect(normalizeStateCode("  new york ")).toBe("NY");
    expect(normalizeStateCode("District of Columbia")).toBe("DC");
  });
  it("rejects garbage and empty input", () => {
    expect(normalizeStateCode("Narnia")).toBeNull();
    expect(normalizeStateCode("")).toBeNull();
    expect(normalizeStateCode(null)).toBeNull();
  });
});

describe("neighborStates", () => {
  it("returns real neighbors and empty for islands", () => {
    expect(neighborStates("TX")).toEqual(
      expect.arrayContaining(["OK", "NM", "AR", "LA"])
    );
    expect(neighborStates("AK")).toEqual([]);
    expect(neighborStates("DC")).toEqual(expect.arrayContaining(["MD", "VA"]));
  });
});

describe("tierOfResult", () => {
  it("tiers local, neighbor, and national", () => {
    expect(tierOfResult("Texas", ["TX"])).toBe("local");
    expect(tierOfResult("TX", ["TX"])).toBe("local");
    expect(tierOfResult("Oklahoma", ["TX"])).toBe("neighbor");
    expect(tierOfResult("California", ["TX"])).toBe("national");
    expect(tierOfResult(null, ["TX"])).toBe("national");
    expect(tierOfResult("Texas", [])).toBe("national");
  });
});

describe("applyGeoScope", () => {
  const results = [
    { geoTier: "national" as const, score: 0.9, state: "California" },
    { geoTier: "national" as const, score: 0.84, state: "Texas" },
    { geoTier: "national" as const, score: 0.85, state: "Oklahoma" },
    { geoTier: "national" as const, score: 0.5, state: null },
  ];
  it("hard-filters to in-state for state scope", () => {
    const filtered = applyGeoScope(results, "state", ["TX"]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({ geoTier: "local", state: "Texas" });
  });
  it("boosts local above higher raw scores for all scope", () => {
    const ranked = applyGeoScope(results, "all", ["TX"]);
    expect(ranked[0]?.state).toBe("Texas");
    expect(ranked[0]?.geoTier).toBe("local");
    expect(ranked[2]?.geoTier).toBe("neighbor");
    expect(ranked[2]?.state).toBe("Oklahoma");
  });
});

describe("parseSearchQuery", () => {
  it("extracts entity + state, leaving vibe text", () => {
    expect(parseSearchQuery("phonk artists in Florida")).toEqual({
      entityTypes: ["artist"],
      states: ["FL"],
      vectorText: "phonk",
    });
    expect(parseSearchQuery("sad songs from Texas about trucks")).toEqual({
      entityTypes: ["track"],
      states: ["TX"],
      vectorText: "sad about trucks",
    });
  });
  it("accepts US- prefixes and full state scope queries", () => {
    expect(parseSearchQuery("country singers US-TX")).toMatchObject({
      entityTypes: ["artist"],
      states: ["TX"],
    });
  });
  it("ignores bare abbreviations without geo cues", () => {
    expect(parseSearchQuery("love songs")).toEqual({
      entityTypes: ["track"],
      states: [],
      vectorText: "love",
    });
    expect(parseSearchQuery("OR should I stay")).toBeNull();
  });
  it("handles West Virginia before Virginia", () => {
    expect(parseSearchQuery("bluegrass from West Virginia")).toMatchObject({
      states: ["WV"],
    });
  });
});

describe("implicitScopeFromHeaders", () => {
  it("reads CDN region headers", () => {
    expect(
      implicitScopeFromHeaders(new Headers({ "cf-region-code": "TX" }))
    ).toEqual(["TX"]);
    expect(implicitScopeFromHeaders(new Headers())).toEqual([]);
  });
});
