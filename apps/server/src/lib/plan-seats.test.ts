import { describe, expect, it } from "vitest";

import {
  assertPlanSeatCount,
  billableSeatsForCheckout,
  maxIncludedSeatsForPlan,
} from "./plan-seats";

describe("plan seat limits", () => {
  it("treats Premium as a three-seat included plan", () => {
    expect(maxIncludedSeatsForPlan("soundkit_premium_artist")).toBe(3);
    expect(maxIncludedSeatsForPlan("soundkit_premium_fan")).toBe(3);
  });

  it("keeps included Premium seats out of Stripe checkout quantity", () => {
    expect(
      billableSeatsForCheckout({
        planCode: "soundkit_premium_artist",
        seats: 3,
      })
    ).toBeUndefined();
    expect(
      billableSeatsForCheckout({ planCode: "soundkit_premium_fan", seats: 3 })
    ).toBeUndefined();
  });

  it("preserves billable quantities for legacy team and family plans", () => {
    expect(
      billableSeatsForCheckout({ planCode: "artist_team", seats: 4 })
    ).toBe(4);
    expect(billableSeatsForCheckout({ planCode: "fan_family", seats: 5 })).toBe(
      5
    );
  });

  it("rejects requests beyond the plan seat cap", () => {
    expect(() =>
      assertPlanSeatCount({
        planCode: "soundkit_premium_artist",
        seats: 4,
      })
    ).toThrow("soundkit_premium_artist allows up to 3 seats.");
  });
});
