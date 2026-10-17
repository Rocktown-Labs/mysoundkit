/* eslint-disable one-var */
import { describe, expect, it } from "vitest";

import { isWorldCountryInMapScope } from "./map-country-scopes";

describe("isWorldCountryInMapScope", () => {
  it("includes every country in the global scope", () => {
    expect(isWorldCountryInMapScope("global", "France")).toBe(true);
    expect(isWorldCountryInMapScope("global", "Brazil")).toBe(true);
    expect(isWorldCountryInMapScope("global", "Atlantis")).toBe(true);
  });

  it("matches countries inside their own scope", () => {
    expect(isWorldCountryInMapScope("europe", "France")).toBe(true);
    expect(isWorldCountryInMapScope("europe", "United Kingdom")).toBe(true);
    expect(isWorldCountryInMapScope("asia", "Japan")).toBe(true);
    expect(isWorldCountryInMapScope("oceania", "Australia")).toBe(true);
    expect(isWorldCountryInMapScope("africa", "Nigeria")).toBe(true);
  });

  it("excludes countries outside the scope slice", () => {
    expect(isWorldCountryInMapScope("europe", "Brazil")).toBe(false);
    expect(isWorldCountryInMapScope("europe", "Japan")).toBe(false);
    expect(isWorldCountryInMapScope("asia", "France")).toBe(false);
    expect(isWorldCountryInMapScope("usa", "Canada")).toBe(false);
  });
});
