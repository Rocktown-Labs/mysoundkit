import type { ArtistSetupGuide } from "./soundkit-api-hooks";

export type ArtistSetupGuideTaskStatus = "available" | "completed" | "locked";

export interface ArtistSetupGuideTask {
  countsTowardProgress: boolean;
  description: string;
  href: string;
  id:
    | "battle-kit"
    | "community"
    | "monetization"
    | "project"
    | "publish-release"
    | "referral"
    | "track";
  status: ArtistSetupGuideTaskStatus;
  title: string;
}

const isPaymentsReady = (state: ArtistSetupGuide) =>
  state.monetization.onboardingStatus === "enabled" &&
  state.monetization.chargesEnabled &&
  state.monetization.payoutsEnabled;

export const buildArtistSetupGuideTasks = (
  state: ArtistSetupGuide
): ArtistSetupGuideTask[] => {
  const paymentsReady = isPaymentsReady(state),
    hasEnoughTracksForProject = state.catalog.trackCount >= 2,
    hasEnoughTracksForBattleKit =
      state.catalog.releasedPlayableTrackCount >=
      state.battleKits.minimumReleasedTracks,
    canCreateBattleKit = state.battleKits.canStart && !state.battleKits.count;

  return [
    {
      countsTowardProgress: state.capabilities.canReceivePayouts,
      description: paymentsReady
        ? "Your connected account is ready to receive sales and creator earnings."
        : state.capabilities.canReceivePayouts
          ? "Finish verification so fans can support you and you can receive payouts."
          : "Unlock Artist Premium to connect payouts, sell releases, and receive creator earnings.",
      href: "/dashboard/career/payments",
      id: "monetization",
      status: paymentsReady ? "completed" : "available",
      title: paymentsReady ? "Monetization is ready" : "Set up monetization",
    },
    {
      countsTowardProgress: true,
      description: state.catalog.hasTrack
        ? "Your first master is in SoundKit. Keep building your catalog."
        : "Upload a master so fans can hear your work and you can build a catalog.",
      href: "/dashboard/tracks/new",
      id: "track",
      status: state.catalog.hasTrack ? "completed" : "available",
      title: "Upload your first track",
    },
    {
      countsTowardProgress: true,
      description: state.catalog.hasPlayablePublicRelease
        ? "Fans can now discover and play your music on SoundKit."
        : "Make one finished track public after its media is ready.",
      href: "/dashboard/tracks",
      id: "publish-release",
      status: state.catalog.hasPlayablePublicRelease
        ? "completed"
        : state.catalog.hasTrack
          ? "available"
          : "locked",
      title: "Publish your first release",
    },
    {
      countsTowardProgress: true,
      description: state.community.hasOwnedCommunity
        ? "Your creator space is ready for updates, conversation, and members."
        : "Start a free community now. Paid membership can be enabled when monetization is ready.",
      href: "/dashboard/community",
      id: "community",
      status: state.community.hasOwnedCommunity ? "completed" : "available",
      title: "Create your community",
    },
    {
      countsTowardProgress: true,
      description: state.referrals.inviteSent
        ? "You have invited someone to discover SoundKit with you."
        : "Invite a friend to discover your music and the SoundKit community.",
      href: "/dashboard",
      id: "referral",
      status: state.referrals.inviteSent ? "completed" : "available",
      title: "Invite a friend to SoundKit",
    },
    {
      countsTowardProgress: true,
      description: state.catalog.hasProject
        ? "Your catalog now has a release container for fans to explore."
        : hasEnoughTracksForProject
          ? "Package two or more tracks into an album, EP, mixtape, or single project."
          : "Upload at least two tracks before packaging a project.",
      href: "/dashboard/projects/new",
      id: "project",
      status: state.catalog.hasProject
        ? "completed"
        : hasEnoughTracksForProject
          ? "available"
          : "locked",
      title: "Build your first release project",
    },
    {
      countsTowardProgress: state.capabilities.canCreateLiveBattles,
      description: state.battleKits.count
        ? "Your Battle Kit is ready for live competition."
        : !state.capabilities.canCreateLiveBattles
          ? "Artist Premium unlocks battles after you have four released, playable tracks."
          : !hasEnoughTracksForBattleKit
            ? `Release ${Math.max(0, state.battleKits.minimumReleasedTracks - state.catalog.releasedPlayableTrackCount)} more playable track${state.battleKits.minimumReleasedTracks - state.catalog.releasedPlayableTrackCount === 1 ? "" : "s"} to build a Battle Kit.`
            : "Choose four released, playable tracks and name your Battle Kit.",
      href: "/dashboard/live/my-kit",
      id: "battle-kit",
      status: state.battleKits.count
        ? "completed"
        : canCreateBattleKit
          ? "available"
          : "locked",
      title: "Prepare your first Battle Kit",
    },
  ];
};

export const artistSetupProgress = (tasks: ArtistSetupGuideTask[]) => {
  const countedTasks = tasks.filter((task) => task.countsTowardProgress),
    completedTasks = countedTasks.filter((task) => task.status === "completed");

  return {
    completed: completedTasks.length,
    percent:
      countedTasks.length > 0
        ? Math.round((completedTasks.length / countedTasks.length) * 100)
        : 100,
    total: countedTasks.length,
  };
};

export const exploratoryArtistSetupTasks = [
  {
    description: "Open a slot for another artist to add their verse.",
    href: "/dashboard/open-verses/new",
    title: "Publish an Open Verse",
  },
  {
    description: "Add an official video, promo, teaser, or live recording.",
    href: "/dashboard/videos/new",
    title: "Add a video",
  },
  {
    description: "Create a stream or listening party for your audience.",
    href: "/dashboard/live/streams",
    title: "Go live",
  },
  {
    description:
      "See where listeners find you and which tracks keep them listening.",
    href: "/dashboard/career/analytics",
    title: "Review your analytics",
  },
  {
    description:
      "Invite managers, engineers, or social support to your workspace.",
    href: "/dashboard/career/team",
    title: "Add a workspace teammate",
  },
] as const;
