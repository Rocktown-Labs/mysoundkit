import { describe, expect, it } from "vitest";

import { serializeV1AccountStatus } from "./seller";

describe("serializeV1AccountStatus", () => {
  it("marks a completed Express account as enabled", () => {
    expect(
      serializeV1AccountStatus({
        charges_enabled: true,
        details_submitted: true,
        payouts_enabled: true,
      })
    ).toEqual({
      chargesEnabled: true,
      detailsSubmitted: true,
      onboardingStatus: "enabled",
      payoutsEnabled: true,
      requirementsDue: [],
    });
  });

  it("keeps accounts with outstanding requirements restricted", () => {
    expect(
      serializeV1AccountStatus({
        charges_enabled: false,
        details_submitted: true,
        payouts_enabled: false,
        requirements: {
          currently_due: ["individual.verification.document"],
        },
      })
    ).toMatchObject({
      onboardingStatus: "restricted",
      requirementsDue: ["individual.verification.document"],
    });
  });
});
