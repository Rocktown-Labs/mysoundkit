import { z } from "@hono/zod-openapi";

export const healthResponseSchema = z.object({
  databaseConfigured: z.boolean(),
  ok: z.boolean(),
  service: z.string(),
  timestamp: z.string(),
});

export const messageResponseSchema = z.object({
  message: z.string(),
});

export const userSummarySchema = z.object({
  accountType: z.enum(["artist", "fan"]),
  displayName: z.string(),
  id: z.string(),
  username: z.string(),
});

export const workspaceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  slug: z.string(),
  workspaceType: z.enum(["artist_team", "fan_family"]),
});

export const entitlementSummarySchema = z.object({
  activePlanCode: z.string().nullable(),
  canCreateLiveBattles: z.boolean(),
  canHostLiveStreams: z.boolean(),
  canViewLiveBattles: z.boolean(),
  canVoteLiveBattles: z.boolean(),
  canWatchCreatorStreams: z.boolean(),
  isPremium: z.boolean(),
  referenceId: z.string().nullable(),
  status: z.string().nullable(),
});

export const meResponseSchema = z.object({
  activeWorkspace: workspaceSummarySchema.nullable(),
  user: userSummarySchema,
});

export const profileUpdateBodySchema = z.object({
  avatarObjectKey: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().optional(),
  city: z.string().optional(),
  displayName: z.string().optional(),
  headerObjectKey: z.string().optional(),
  headerUrl: z.string().url().optional(),
  state: z.string().optional(),
});

export const planSchema = z.object({
  adsEnabled: z.boolean(),
  audience: z.enum(["artist", "fan"]),
  canViewLiveBattles: z.boolean(),
  canVoteLiveBattles: z.boolean(),
  code: z.string(),
  monthlyPrice: z.number(),
  name: z.string(),
  supportsWorkspaceSeats: z.boolean(),
});

export const artistSummarySchema = z.object({
  followers: z.number(),
  genre: z.string(),
  id: z.string(),
  location: z.string(),
  name: z.string(),
  username: z.string(),
  verified: z.boolean(),
});

export const trackSummarySchema = z.object({
  artistName: z.string(),
  duration: z.string(),
  genre: z.string(),
  id: z.string(),
  isForSale: z.boolean(),
  plays: z.number(),
  price: z.number().nullable(),
  releaseAt: z.string().nullable().optional(),
  releaseStrategy: z.enum(["private", "publish_when_ready", "scheduled"]),
  slug: z.string(),
  title: z.string(),
});

export const projectSummarySchema = z.object({
  id: z.string(),
  isPublic: z.boolean(),
  projectType: z.enum(["album", "ep", "single"]),
  slug: z.string(),
  title: z.string(),
  trackCount: z.number(),
});

export const videoSummarySchema = z.object({
  externalPlaybackUrl: z.string().url().nullable().optional(),
  id: z.string(),
  muxPlaybackId: z.string().nullable(),
  playbackPolicy: z.enum(["public", "signed"]),
  sourceProjectId: z.string().nullable().optional(),
  sourceProvider: z.enum(["mux", "external"]).default("mux"),
  sourceTrackId: z.string().nullable().optional(),
  status: z.string(),
  title: z.string(),
  verifiedOnPlatform: z.boolean().default(false),
  videoKind: z.enum([
    "music_video",
    "promo",
    "teaser",
    "battle_replay",
    "battle_clip",
    "live_recording",
  ]),
});

export const playlistSchema = z.object({
  description: z.string().nullable(),
  id: z.string(),
  isPublic: z.boolean(),
  title: z.string(),
  trackCount: z.number(),
});

export const conversationSummarySchema = z.object({
  conversationType: z.enum(["direct", "group", "battle_live"]),
  id: z.string(),
  title: z.string(),
  unreadCount: z.number(),
  updatedAt: z.string(),
});

export const messageSchema = z.object({
  body: z.string(),
  createdAt: z.string(),
  id: z.string(),
  senderId: z.string(),
  status: z.enum(["sent", "delivered", "read", "deleted"]),
});

export const battleSummarySchema = z.object({
  format: z.enum(["best_of_3", "best_of_5", "best_of_7"]),
  genre: z.string(),
  id: z.string(),
  status: z.enum(["scheduled", "live", "completed", "archived"]),
  title: z.string(),
  viewerCount: z.number(),
  visibility: z.enum(["public", "premium_only"]),
});

export const libraryOverviewSchema = z.object({
  playlistCount: z.number(),
  purchaseCount: z.number(),
  recentPlayCount: z.number(),
  savedTrackCount: z.number(),
});

export const analyticsOverviewSchema = z.object({
  totalDownloads: z.number(),
  totalFollowers: z.number(),
  totalPlays: z.number(),
  totalRevenue: z.number(),
});

export const commentSchema = z.object({
  body: z.string(),
  createdAt: z.string(),
  id: z.string(),
  userId: z.string(),
  username: z.string(),
});

export const onboardingArtistBodySchema = z.object({
  appleMusicUrl: z.url().optional(),
  city: z.string().min(1),
  instagramHandle: z.string().optional(),
  primaryGenre: z.string().min(1),
  selectedPlanCode: z.string(),
  spotifyUrl: z.url().optional(),
  state: z.string().min(1),
  teamInviteEmails: z.array(z.email()).default([]),
  tiktokHandle: z.string().optional(),
  twitterHandle: z.string().optional(),
  username: z.string().min(3),
  youtubeUrl: z.url().optional(),
});

export const onboardingFanBodySchema = z.object({
  city: z.string().min(1),
  genrePreferences: z.array(z.string()).min(3),
  selectedPlanCode: z.string(),
  state: z.string().min(1),
  username: z.string().min(3),
});

export const createTrackBodySchema = z.object({
  bpm: z.number().int().positive().optional(),
  description: z.string().optional(),
  genre: z.string().min(1),
  isForSale: z.boolean(),
  isPublic: z.boolean(),
  musicalKey: z.string().optional(),
  price: z.number().nonnegative().optional(),
  productionStatus: z.enum(["demo", "mixed", "mastered", "complete"]),
  releaseAt: z.string().datetime().optional(),
  releaseStrategy: z.enum(["private", "publish_when_ready", "scheduled"]),
  title: z.string().min(1),
});

export const createProjectBodySchema = z.object({
  description: z.string().optional(),
  projectType: z.enum(["album", "ep", "single"]),
  releaseDate: z.string().optional(),
  title: z.string().min(1),
  trackIds: z.array(z.string()).min(1),
});

export const createVideoBodySchema = z.object({
  description: z.string().optional(),
  externalPlaybackUrl: z.url().optional(),
  playbackPolicy: z.enum(["public", "signed"]).default("public"),
  sourceProjectId: z.string().optional(),
  sourceTrackId: z.string().optional(),
  sourceProvider: z.enum(["mux", "external"]).default("mux"),
  title: z.string().min(1),
  videoKind: z.enum([
    "music_video",
    "promo",
    "teaser",
    "battle_replay",
    "battle_clip",
    "live_recording",
  ]),
});

export const directVideoUploadBodySchema = z.object({
  description: z.string().optional(),
  playbackPolicy: z.enum(["public", "signed"]).default("public"),
  sourceProjectId: z.string().optional(),
  sourceTrackId: z.string().min(1),
  title: z.string().min(1),
});

export const directVideoUploadResponseSchema = z.object({
  status: z.enum(["pending", "uploading", "uploaded", "processing", "ready"]),
  uploadId: z.string(),
  uploadUrl: z.url(),
  videoId: z.string(),
});

export const createPlaylistBodySchema = z.object({
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  title: z.string().min(1),
});

export const createChallengeBodySchema = z.object({
  format: z.enum(["best_of_3", "best_of_5", "best_of_7"]),
  genre: z.string().min(1),
  message: z.string().optional(),
  opponentUsername: z.string().min(1),
  proposedDate: z.string().optional(),
  proposedTimeLabel: z.string().optional(),
});

export const createCommentBodySchema = z.object({
  body: z.string().min(1),
});

export const createConversationBodySchema = z.object({
  participantUserIds: z.array(z.string()).min(1),
  title: z.string().optional(),
});

export const createMessageBodySchema = z.object({
  body: z.string().min(1),
});
