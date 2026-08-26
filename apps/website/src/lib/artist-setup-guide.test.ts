import { describe, expect, it } from "vitest";

import {
  artistSetupProgress,
  buildArtistSetupGuideTasks,
} from "./artist-setup-guide";
import type { ArtistSetupGuide } from "./soundkit-api-hooks";

const makeState = (
  overrides: Partial<ArtistSetupGuide> = {}
): ArtistSetupGuide => ({
  battleKits: { canStart: false, count: 0, minimumReleasedTracks: 4 },
  capabilities: {
    canCreateLiveBattles: false,
    canHostLiveStreams: false,
    canOperatePaidCommunity: false,
    canReceivePayouts: false,
    canSellProducts: false,
    isPremium: false,
  },
  catalog: {
    hasPlayablePublicRelease: false,
    hasProject: false,
    hasSellableItem: false,
    hasTrack: false,
    releasedPlayableTrackCount: 0,
    trackCount: 0,
  },
  community: { hasOwnedCommunity: false },
  creatorTools: {
    hasLiveExperience: false,
    hasOpenVerse: false,
    hasVideo: false,
  },
  monetization: {
    chargesEnabled: false,
    detailsSubmitted: false,
    onboardingStatus: "not_started",
    payoutsEnabled: false,
  },
  profile: { isPublicReady: true },
  referrals: { inviteSent: false },
  ...overrides,
});

describe("artist setup guide", () => {
  it("does not make Free artists wait on Premium-only tasks", () => {
    const tasks = buildArtistSetupGuideTasks(makeState()),
      progress = artistSetupProgress(tasks);

    expect(tasks.find((task) => task.id === "monetization")?.status).toBe(
      "available"
    );
    expect(tasks.find((task) => task.id === "battle-kit")?.status).toBe(
      "locked"
    );
    expect(progress.total).toBe(5);
    expect(progress.completed).toBe(0);
  });

  it("unlocks Battle Kit creation at four released playable tracks", () => {
    const state = makeState({
        battleKits: { canStart: true, count: 0, minimumReleasedTracks: 4 },
        capabilities: {
          canCreateLiveBattles: true,
          canHostLiveStreams: true,
          canOperatePaidCommunity: true,
          canReceivePayouts: true,
          canSellProducts: true,
          isPremium: true,
        },
        catalog: {
          hasPlayablePublicRelease: true,
          hasProject: true,
          hasSellableItem: true,
          hasTrack: true,
          releasedPlayableTrackCount: 4,
          trackCount: 4,
        },
        monetization: {
          chargesEnabled: true,
          detailsSubmitted: true,
          onboardingStatus: "enabled",
          payoutsEnabled: true,
        },
      }),
      tasks = buildArtistSetupGuideTasks(state);

    expect(tasks.find((task) => task.id === "battle-kit")?.status).toBe(
      "available"
    );
    expect(tasks.find((task) => task.id === "project")?.status).toBe(
      "completed"
    );
  });

  it("completes community and referral tasks from persisted facts", () => {
    const tasks = buildArtistSetupGuideTasks(
      makeState({
        community: { hasOwnedCommunity: true },
        referrals: { inviteSent: true },
      })
    );

    expect(tasks.find((task) => task.id === "community")?.status).toBe(
      "completed"
    );
    expect(tasks.find((task) => task.id === "referral")?.status).toBe(
      "completed"
    );
  });
});
