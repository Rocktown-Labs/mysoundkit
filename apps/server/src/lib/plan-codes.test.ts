import { describe, expect, it } from "vitest";

import { CONFIGURED_PAID_PLAN_CODES, FREE_PLAN_CODES } from "./plan-codes";
import { samplePlans } from "./sample-data";

describe("billing plan codes", () => {
  it("accepts only the new paid plan codes", () => {
    expect([...CONFIGURED_PAID_PLAN_CODES].toSorted()).toEqual(
      [
        "soundkit_premium_artist",
        "soundkit_premium_fan",
      ].toSorted()
    );
    expect(CONFIGURED_PAID_PLAN_CODES.has("artist_lite_ads")).toBe(false);
    expect(CONFIGURED_PAID_PLAN_CODES.has("fan_lite_ads")).toBe(false);
  });

  it("recognizes the two free plans", () => {
    expect([...FREE_PLAN_CODES].toSorted()).toEqual([
      "artist_free",
      "fan_free",
    ]);
  });

  it("advertises five included seats for Premium fallback catalog data", () => {
    expect(
      samplePlans.find((plan) => plan.code === "soundkit_premium_artist")
        ?.maxSeats
    ).toBe(5);
    expect(
      samplePlans.find((plan) => plan.code === "soundkit_premium_fan")?.maxSeats
    ).toBe(5);
  });
});
