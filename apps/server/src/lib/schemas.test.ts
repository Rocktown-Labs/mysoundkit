import { describe, expect, it } from "vitest";

import {
  artistSummarySchema,
  createProjectBodySchema,
  createTrackAssetBodySchema,
  friendSummarySchema,
  onboardingArtistBodySchema,
  onboardingFanBodySchema,
  userSummarySchema,
} from "./schemas";

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
  it.each(["artist_free", "soundkit_premium_artist", "artist_team"])(
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

  it.each(["fan_free", "soundkit_premium_fan", "fan_family"])(
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

describe("artist dashboard release schemas", () => {
  it("accepts mixtape projects for multi-track releases", () => {
    const result = createProjectBodySchema.safeParse({
      assetIds: ["asset_cover"],
      collaboratorNames: ["Ava Rhodes", "Milo Park"],
      isPublic: true,
      newTracks: [
        {
          assetId: "asset_track_1",
          genre: "Hip-Hop",
          title: "Intro Tape",
        },
        {
          assetId: "asset_track_2",
          genre: "Hip-Hop",
          title: "Second Side",
        },
      ],
      projectType: "mixtape",
      title: "Downtown Demos",
      trackIds: [],
    });

    expect(result.success).toBe(true);
  });

  it("accepts uploaded cover art metadata for track publishing", () => {
    const result = createTrackAssetBodySchema.safeParse({
      assetKind: "cover_art",
      bucketName: "soundkit-uploads",
      metadata: {
        height: 3000,
        source: "artist-dashboard",
        width: 3000,
      },
      mimeType: "image/jpeg",
      objectKey: "tracks/track_1/cover.jpg",
      sizeBytes: 512_000,
    });

    expect(result.success).toBe(true);
  });

  it("models friends and collaborators shown in messaging", () => {
    const result = friendSummarySchema.safeParse({
      avatarUrl: "https://media.soundkit.test/avatars/ava.jpg",
      email: "ava@example.com",
      id: "user_ava",
      lastInteractionAt: "2026-07-13T12:00:00.000Z",
      name: "Ava Rhodes",
      relationship: "collaborator",
      role: "producer",
      username: "ava-rhodes",
    });

    expect(result.success).toBe(true);
  });
});

describe("public profile schemas", () => {
  it("exposes the current user's role for client navigation gates", () => {
    const result = userSummarySchema.safeParse({
      accountType: "artist",
      avatarUrl: null,
      city: "Little Rock",
      displayName: "CG Stewart",
      id: "user_cg",
      role: "admin",
      state: "AR",
      username: "cgstewart",
    });

    expect(result.success).toBe(true);
  });

  it("accepts real artist profile media, stats, and platform links", () => {
    const result = artistSummarySchema.safeParse({
      avatarUrl: "https://media.soundkit.test/profiles/cg/avatar.jpg",
      battleCount: 4,
      bio: "Making records in Little Rock.",
      coverImageUrl: "https://media.soundkit.test/profiles/cg/header.jpg",
      followers: 1200,
      genre: "Hip-Hop",
      id: "user_cg",
      joinedAt: "2026-07-01T12:00:00.000Z",
      links: {
        apple: "https://music.apple.com/us/artist/cg",
        spotify: "https://open.spotify.com/artist/cg",
        youtube: "https://music.youtube.com/channel/cg",
      },
      location: "Little Rock, AR",
      name: "CG Stewart",
      projectCount: 3,
      rank: 1,
      trackCount: 12,
      username: "cgstewart",
      verified: true,
      weeklyPlays: 44_000,
    });

    expect(result.success).toBe(true);
  });
});
