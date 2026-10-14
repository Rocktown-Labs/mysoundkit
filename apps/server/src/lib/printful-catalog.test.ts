import { describe, expect, it } from "vitest";

import {
  defaultRetailBoundsCents,
  validateRetailBoundsCents,
} from "./printful-catalog";

describe("Printful catalog retail bounds", () => {
  it("derives healthy default bounds from the cheapest base cost", () => {
    // $24.50 hoodie base → floor ≈ $39.20, ceiling ≈ $78.40
    expect(defaultRetailBoundsCents(2450)).toEqual({
      retailMaxCents: 7900,
      retailMinCents: 4000,
    });

    // Cheap blanks never drop below the $12.00 platform floor.
    expect(defaultRetailBoundsCents(175).retailMinCents).toBeGreaterThanOrEqual(
      1200
    );
    expect(defaultRetailBoundsCents(175).retailMaxCents).toBeGreaterThan(
      defaultRetailBoundsCents(175).retailMinCents
    );
  });

  it("always keeps the maximum above the minimum with a real spread", () => {
    for (const base of [175, 495, 2450, 3600, 9900]) {
      const bounds = defaultRetailBoundsCents(base);

      expect(bounds.retailMaxCents).toBeGreaterThan(
        bounds.retailMinCents + 1000
      );
    }
  });

  it("rejects invalid or inverted bounds", () => {
    expect(
      validateRetailBoundsCents({ retailMaxCents: 2500, retailMinCents: 1200 })
        .valid
    ).toBe(true);
    expect(
      validateRetailBoundsCents({ retailMaxCents: 1000, retailMinCents: 2000 })
        .valid
    ).toBe(false);
    expect(
      validateRetailBoundsCents({
        retailMaxCents: 5000,
        retailMinCents: 1100,
      }).valid
    ).toBe(false);
    expect(
      validateRetailBoundsCents({
        retailMaxCents: 5000,
        retailMinCents: Number.NaN,
      }).valid
    ).toBe(false);
  });
});
