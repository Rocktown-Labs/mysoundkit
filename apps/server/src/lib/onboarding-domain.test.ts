import { describe, expect, it } from "vitest";

import { canCompleteArtistOnboarding } from "./onboarding-domain";

describe("artist onboarding eligibility", () => {
  it("requires a saved independent declaration", () => {
    expect(
      canCompleteArtistOnboarding({
        savedEligibility: undefined,
        submittedEligibility: "independent",
      })
    ).toBe(false);
    expect(canCompleteArtistOnboarding({ savedEligibility: null })).toBe(false);
  });

  it("allows an independent declaration to complete", () => {
    expect(
      canCompleteArtistOnboarding({ savedEligibility: "independent" })
    ).toBe(true);
    expect(
      canCompleteArtistOnboarding({
        savedEligibility: "independent",
        submittedEligibility: "independent",
      })
    ).toBe(true);
  });

  it("does not allow a major-label declaration to complete as Artist", () => {
    expect(
      canCompleteArtistOnboarding({
        savedEligibility: "major_label_affiliated",
      })
    ).toBe(false);
    expect(
      canCompleteArtistOnboarding({
        savedEligibility: "independent",
        submittedEligibility: "major_label_affiliated",
      })
    ).toBe(false);
  });
});
