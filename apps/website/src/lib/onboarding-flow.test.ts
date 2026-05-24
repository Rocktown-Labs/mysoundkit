import { describe, expect, it } from "vitest";

import {
  credentialsRouteForAccount,
  onboardingRouteForAccount,
  parseArtistOnboardingDraft,
  signupRedirectForUser,
} from "./onboarding-flow";

describe("signup onboarding flow", () => {
  it("routes incomplete authenticated users to the matching onboarding flow", () => {
    expect(
      signupRedirectForUser({
        accountType: "artist",
        user: { onboardingCompletedAt: null },
      })
    ).toBe("/signup/artist/onboarding");
    expect(
      signupRedirectForUser({
        accountType: "fan",
        user: { onboardingCompletedAt: undefined },
      })
    ).toBe("/signup/fan/onboarding");
  });

  it("routes completed users away from signup", () => {
    expect(
      signupRedirectForUser({
        accountType: "artist",
        user: { onboardingCompletedAt: "2026-05-24T12:00:00.000Z" },
      })
    ).toBe("/dashboard");
  });

  it("keeps credentials and onboarding routes paired by account type", () => {
    expect(credentialsRouteForAccount("artist")).toBe(
      "/signup/artist/credentials"
    );
    expect(onboardingRouteForAccount("artist")).toBe(
      "/signup/artist/onboarding"
    );
    expect(credentialsRouteForAccount("fan")).toBe("/signup/fan/credentials");
    expect(onboardingRouteForAccount("fan")).toBe("/signup/fan/onboarding");
  });

  it("restores valid artist onboarding draft fields", () => {
    expect(
      parseArtistOnboardingDraft(
        JSON.stringify({
          city: "Little Rock",
          locationQuery: "Little Rock, AR",
          primaryGenre: "Hip-Hop",
          roles: ["musician", "producer"],
          selectedPlanCode: "artist_pro",
          stateValue: "AR",
          step: 3,
          username: "cam",
        })
      )
    ).toEqual({
      city: "Little Rock",
      locationQuery: "Little Rock, AR",
      primaryGenre: "Hip-Hop",
      roles: ["musician", "producer"],
      selectedPlanCode: "artist_pro",
      stateValue: "AR",
      step: 3,
      username: "cam",
    });
  });

  it("sanitizes partial artist onboarding drafts", () => {
    expect(
      parseArtistOnboardingDraft(
        JSON.stringify({
          roles: ["artist", "musician"],
          selectedPlanCode: 1,
          stateValue: null,
          step: 99,
          username: "cam",
        })
      )
    ).toEqual({
      city: "",
      locationQuery: "",
      primaryGenre: "",
      roles: ["musician"],
      selectedPlanCode: "artist_lite_ads",
      stateValue: "",
      step: 7,
      username: "cam",
    });
  });
});
