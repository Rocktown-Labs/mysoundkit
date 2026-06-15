import { describe, expect, it } from "vitest";

import { onboardingArtistBodySchema, onboardingFanBodySchema } from "./schemas";

const artistOnboardingPayload = {
  city: "Little Rock",
  primaryGenre: "Hip-Hop",
  roles: ["musician"],
  selectedPlanCode: "artist_free",
  state: "AR",
  teamInviteEmails: [],
  username: "soundkit_artist",
};

describe("artist onboarding profile picture", () => {
  it("keeps the profile picture optional", () => {
    expect(
      onboardingArtistBodySchema.safeParse(artistOnboardingPayload).success
    ).toBe(true);
  });

  it("accepts uploaded profile picture metadata", () => {
    expect(
      onboardingArtistBodySchema.safeParse({
        ...artistOnboardingPayload,
        avatarObjectKey: "profiles/user/avatar.jpg",
        avatarUrl: "https://media.soundkit.test/profiles/user/avatar.jpg",
      }).success
    ).toBe(true);
  });

  it("rejects invalid profile picture URLs", () => {
    expect(
      onboardingArtistBodySchema.safeParse({
        ...artistOnboardingPayload,
        avatarObjectKey: "profiles/user/avatar.jpg",
        avatarUrl: "not-a-url",
      }).success
    ).toBe(false);
  });

  it("rejects incomplete profile picture metadata", () => {
    expect(
      onboardingArtistBodySchema.safeParse({
        ...artistOnboardingPayload,
        avatarObjectKey: "profiles/user/avatar.jpg",
      }).success
    ).toBe(false);
  });
});

describe("onboarding plan codes", () => {
  it.each(["artist_free", "artist_premium", "artist_team"])(
    "accepts artist plan %s",
    (selectedPlanCode) => {
      expect(
        onboardingArtistBodySchema.safeParse({
          ...artistOnboardingPayload,
          selectedPlanCode,
        }).success
      ).toBe(true);
    }
  );

  it.each(["artist_lite_ads", "fan_free", "unknown"])(
    "rejects invalid artist plan %s",
    (selectedPlanCode) => {
      expect(
        onboardingArtistBodySchema.safeParse({
          ...artistOnboardingPayload,
          selectedPlanCode,
        }).success
      ).toBe(false);
    }
  );

  const fanPayload = {
    city: "Chicago",
    genrePreferences: ["House", "Hip-Hop", "Soul"],
    state: "IL",
    username: "soundkit_fan",
  };

  it.each(["fan_free", "listener_premium", "fan_family"])(
    "accepts fan plan %s",
    (selectedPlanCode) => {
      expect(
        onboardingFanBodySchema.safeParse({
          ...fanPayload,
          selectedPlanCode,
        }).success
      ).toBe(true);
    }
  );

  it.each(["fan_lite_ads", "artist_free", "unknown"])(
    "rejects invalid fan plan %s",
    (selectedPlanCode) => {
      expect(
        onboardingFanBodySchema.safeParse({
          ...fanPayload,
          selectedPlanCode,
        }).success
      ).toBe(false);
    }
  );
});
