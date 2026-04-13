export const sampleUser = {
  accountType: "artist" as const,
  displayName: "Luna Eclipse",
  id: "user_demo_artist",
  username: "luna-eclipse",
};

export const sampleWorkspace = {
  id: "org_luna_collective",
  name: "Luna Collective",
  role: "owner",
  slug: "luna-collective",
  workspaceType: "artist_team" as const,
};

export const samplePlans = [
  {
    adsEnabled: true,
    audience: "artist" as const,
    canViewLiveBattles: false,
    canVoteLiveBattles: false,
    code: "artist_free",
    monthlyPrice: 0,
    name: "Artist Free",
    supportsWorkspaceSeats: false,
  },
  {
    adsEnabled: true,
    audience: "artist" as const,
    canViewLiveBattles: true,
    canVoteLiveBattles: true,
    code: "artist_lite_ads",
    monthlyPrice: 9.99,
    name: "Artist Lite",
    supportsWorkspaceSeats: false,
  },
  {
    adsEnabled: false,
    audience: "artist" as const,
    canViewLiveBattles: true,
    canVoteLiveBattles: true,
    code: "artist_team",
    monthlyPrice: 19.99,
    name: "Artist Team",
    supportsWorkspaceSeats: true,
  },
  {
    adsEnabled: true,
    audience: "fan" as const,
    canViewLiveBattles: false,
    canVoteLiveBattles: false,
    code: "fan_free",
    monthlyPrice: 0,
    name: "Fan Free",
    supportsWorkspaceSeats: false,
  },
  {
    adsEnabled: true,
    audience: "fan" as const,
    canViewLiveBattles: true,
    canVoteLiveBattles: true,
    code: "fan_lite_ads",
    monthlyPrice: 9.99,
    name: "Fan Lite",
    supportsWorkspaceSeats: false,
  },
  {
    adsEnabled: false,
    audience: "fan" as const,
    canViewLiveBattles: true,
    canVoteLiveBattles: true,
    code: "fan_family",
    monthlyPrice: 19.99,
    name: "Fan Family",
    supportsWorkspaceSeats: true,
  },
];

export const sampleArtists = [
  {
    followers: 124_000,
    genre: "R&B/Soul",
    id: "artist_luna",
    location: "Los Angeles, CA",
    name: "Luna Eclipse",
    username: "luna-eclipse",
    verified: true,
  },
  {
    followers: 8200,
    genre: "Electronic",
    id: "artist_neon",
    location: "Austin, TX",
    name: "Neon Pulse",
    username: "neon-pulse",
    verified: false,
  },
];

export const sampleTracks = [
  {
    artistName: "Luna Eclipse",
    duration: "3:45",
    genre: "R&B/Soul",
    id: "track_midnight_vibes",
    isForSale: true,
    plays: 12_543,
    price: 2.99,
    slug: "midnight-vibes",
    title: "Midnight Vibes",
  },
  {
    artistName: "Neon Pulse",
    duration: "4:12",
    genre: "Electronic",
    id: "track_electric_dreams",
    isForSale: true,
    plays: 8241,
    price: 2.49,
    slug: "electric-dreams",
    title: "Electric Dreams",
  },
];

export const sampleProjects = [
  {
    id: "project_after_dark",
    isPublic: true,
    projectType: "ep" as const,
    slug: "after-dark",
    title: "After Dark",
    trackCount: 5,
  },
];

export const sampleVideos = [
  {
    id: "video_midnight_vibes_mv",
    muxPlaybackId: null,
    playbackPolicy: "public" as const,
    status: "processing",
    title: "Midnight Vibes Official Video",
    videoKind: "music_video" as const,
  },
];

export const samplePlaylists = [
  {
    description: "Late-night rotation",
    id: "playlist_after_hours",
    isPublic: false,
    title: "After Hours",
    trackCount: 12,
  },
];

export const sampleConversations = [
  {
    conversationType: "direct" as const,
    id: "conv_sarah",
    title: "Sarah Johnson",
    unreadCount: 2,
    updatedAt: new Date().toISOString(),
  },
];

export const sampleMessages = [
  {
    body: "Hey! I added the vocals to the track.",
    createdAt: new Date().toISOString(),
    id: "msg_1",
    senderId: "user_sarah",
    status: "read" as const,
  },
  {
    body: "Sounds great. I will review it tonight.",
    createdAt: new Date().toISOString(),
    id: "msg_2",
    senderId: sampleUser.id,
    status: "delivered" as const,
  },
];

export const sampleBattles = [
  {
    format: "best_of_5" as const,
    genre: "Hip-Hop",
    id: "battle_west_coast_showdown",
    status: "live" as const,
    title: "West Coast Showdown",
    viewerCount: 4321,
    visibility: "premium_only" as const,
  },
];

export const sampleComments = [
  {
    body: "This is amazing!",
    createdAt: new Date().toISOString(),
    id: "comment_1",
    userId: "fan_1",
    username: "nightowl",
  },
];

export const sampleLibraryOverview = {
  playlistCount: 3,
  purchaseCount: 4,
  recentPlayCount: 18,
  savedTrackCount: 22,
};

export const sampleAnalyticsOverview = {
  totalDownloads: 3421,
  totalFollowers: 1234,
  totalPlays: 12_543,
  totalRevenue: 2847.32,
};
