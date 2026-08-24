import { describe, expect, it } from "vitest";

import {
  isWorldCountryInMapScope,
  regionalWorldCountryNames,
} from "./map-country-scopes";

describe("regional world map countries", () => {
  it("keeps each continental scope limited to its own countries", () => {
    expect(isWorldCountryInMapScope("asia", "China")).toBe(true);
    expect(isWorldCountryInMapScope("asia", "Brazil")).toBe(false);
    expect(isWorldCountryInMapScope("europe", "France")).toBe(true);
    expect(isWorldCountryInMapScope("europe", "Kenya")).toBe(false);
    expect(isWorldCountryInMapScope("africa", "Nigeria")).toBe(true);
    expect(isWorldCountryInMapScope("africa", "Australia")).toBe(false);
    expect(isWorldCountryInMapScope("latin-america", "Brazil")).toBe(true);
    expect(isWorldCountryInMapScope("latin-america", "Japan")).toBe(false);
    expect(isWorldCountryInMapScope("oceania", "Australia")).toBe(true);
    expect(isWorldCountryInMapScope("oceania", "India")).toBe(false);
  });

  it("preserves global and North America as separate map layers", () => {
    expect(isWorldCountryInMapScope("global", "Brazil")).toBe(true);
    expect(isWorldCountryInMapScope("north-america", "Brazil")).toBe(true);
    expect(regionalWorldCountryNames.africa.has("W. Sahara")).toBe(true);
    expect(regionalWorldCountryNames.asia.has("Turkey")).toBe(true);
  });
});
