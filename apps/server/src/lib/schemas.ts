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

export const artistRoleSchema = z.enum(["musician", "producer"]);
export const catalogItemTypeSchema = z.enum([
  "single",
  "album",
  "ep",
  "beat",
  "instrumental",
]);
export const purchaseModeSchema = z.enum(["digital_download", "license"]);
export const commerceProductTypeSchema = z.enum(["track", "project"]);

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
  roles: artistRoleSchema.array().default(["musician"]),
  username: z.string(),
  verified: z.boolean(),
});

export const trackSummarySchema = z.object({
  artistName: z.string(),
  catalogItemType: catalogItemTypeSchema.optional(),
  duration: z.string(),
  genre: z.string(),
  id: z.string(),
  isForSale: z.boolean(),
  plays: z.number(),
  price: z.number().nullable(),
  priceCents: z.number().int().nullable().optional(),
  purchaseMode: purchaseModeSchema.optional(),
  releaseAt: z.string().nullable().optional(),
  releaseStrategy: z.enum(["private", "publish_when_ready", "scheduled"]),
  slug: z.string(),
  title: z.string(),
});

export const catalogArtistSchema = z.object({
  avatarUrl: z.string().nullable().optional(),
  battleRank: z.string().nullable().optional(),
  battleRecord: z.string().nullable().optional(),
  followers: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  handle: z.string(),
  id: z.string(),
  listeners: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  name: z.string(),
  roles: artistRoleSchema.array(),
  verified: z.boolean(),
});

export const catalogAssetSchema = z.object({
  duration: z.string().nullable().optional(),
  format: z.string().nullable().optional(),
  id: z.string(),
  included: z.boolean(),
  kind: z.enum([
    "master",
    "clean",
    "instrumental",
    "alternate_mix",
    "artwork",
    "booklet",
    "tagged_mp3",
    "untagged_wav",
    "stems",
    "midi",
    "license_pdf",
  ]),
  label: z.string(),
  subtitle: z.string().nullable().optional(),
});

export const catalogLicenseOptionSchema = z.object({
  currency: z.string().default("USD"),
  id: z.string(),
  includesStems: z.boolean().default(false),
  isExclusive: z.boolean().default(false),
  name: z.string(),
  priceCents: z.number().int(),
  priceLabel: z.string(),
  rightsSummary: z.array(z.string()),
});

export const catalogVisualContentSchema = z.object({
  id: z.string(),
  thumbnailUrl: z.string(),
  title: z.string(),
  type: z.enum(["video", "photo", "artwork"]),
  views: z.string().nullable().optional(),
});

export const trackCatalogDetailSchema = z.object({
  artist: catalogArtistSchema,
  assets: catalogAssetSchema.array(),
  bpm: z.number().int().nullable().optional(),
  catalogItemType: catalogItemTypeSchema,
  coverArtUrl: z.string(),
  currency: z.string().default("USD"),
  description: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  id: z.string(),
  isOwned: z.boolean().default(false),
  isPurchasable: z.boolean(),
  isStreamable: z.boolean(),
  licenseOptions: catalogLicenseOptionSchema.array().default([]),
  musicalKey: z.string().nullable().optional(),
  priceCents: z.number().int().nullable(),
  priceLabel: z.string(),
  purchaseMode: purchaseModeSchema,
  slug: z.string(),
  streamCount: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  title: z.string(),
  visualContent: catalogVisualContentSchema.array().default([]),
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

export const purchasedCatalogItemSchema = z.object({
  artist: z.string(),
  artistSlug: z.string(),
  cover: z.string(),
  downloadUrl: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  id: z.string(),
  licenseName: z.string().nullable().optional(),
  priceCents: z.number().int(),
  priceLabel: z.string(),
  productType: commerceProductTypeSchema,
  purchaseMode: purchaseModeSchema,
  purchasedAt: z.string(),
  title: z.string(),
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
  roles: artistRoleSchema.array().min(1).default(["musician"]),
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
  catalogItemType: z.enum(["single", "beat", "instrumental"]).default("single"),
  description: z.string().optional(),
  genre: z.string().min(1),
  isForSale: z.boolean(),
  isPublic: z.boolean(),
  musicalKey: z.string().optional(),
  price: z.number().nonnegative().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  productionStatus: z.enum(["demo", "mixed", "mastered", "complete"]),
  purchaseMode: purchaseModeSchema.default("digital_download"),
  releaseAt: z.string().datetime().optional(),
  releaseStrategy: z.enum(["private", "publish_when_ready", "scheduled"]),
  title: z.string().min(1),
});

export const cartItemSchema = z.object({
  artistName: z.string().nullable().optional(),
  coverArtUrl: z.string().nullable().optional(),
  currency: z.string().default("USD"),
  id: z.string(),
  licenseName: z.string().nullable().optional(),
  licenseOptionId: z.string().nullable().optional(),
  priceCents: z.number().int(),
  productId: z.string(),
  productType: commerceProductTypeSchema,
  purchaseMode: purchaseModeSchema,
  quantity: z.number().int().positive(),
  title: z.string(),
  trackId: z.string().nullable().optional(),
});

export const cartSchema = z.object({
  currency: z.string().default("USD"),
  id: z.string().nullable(),
  itemCount: z.number().int(),
  items: cartItemSchema.array(),
  subtotalCents: z.number().int(),
  totalCents: z.number().int(),
});

export const addCartItemBodySchema = z.object({
  licenseOptionId: z.string().optional(),
  productType: commerceProductTypeSchema,
  projectId: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  trackId: z.string().optional(),
});

export const updateCartItemBodySchema = z.object({
  quantity: z.number().int().positive(),
});

export const claimCartBodySchema = z.object({
  items: addCartItemBodySchema.array(),
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
  sourceProvider: z.enum(["mux", "external"]).default("mux"),
  sourceTrackId: z.string().optional(),
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
