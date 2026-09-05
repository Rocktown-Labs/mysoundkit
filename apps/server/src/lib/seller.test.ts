import { describe, expect, it } from "vitest";

import { isSellerReadyForTips, serializeV1AccountStatus } from "./seller";

describe("isSellerReadyForTips", () => {
  const baseSeller = {
    chargesEnabled: true,
    onboardingStatus: "enabled",
    payoutsEnabled: true,
  };

  it("requires both charges and payouts to be enabled", () => {
    expect(isSellerReadyForTips(baseSeller)).toBe(true);
    expect(isSellerReadyForTips({ ...baseSeller, chargesEnabled: false })).toBe(
      false
    );
    expect(isSellerReadyForTips({ ...baseSeller, payoutsEnabled: false })).toBe(
      false
    );
  });

  it("rejects accounts that have not completed onboarding", () => {
    expect(
      isSellerReadyForTips({ ...baseSeller, onboardingStatus: "pending" })
    ).toBe(false);
  });
});

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
