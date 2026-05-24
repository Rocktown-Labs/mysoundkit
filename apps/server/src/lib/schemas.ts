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

export const setupRequiredResponseSchema = z.object({
  code: z.literal("setup_required"),
  message: z.string(),
});

export const userSummarySchema = z.object({
  accountType: z.enum(["artist", "fan"]),
  displayName: z.string(),
  id: z.string(),
  onboardingCompletedAt: z.string().nullable().optional(),
  username: z.string(),
});

export const artistRoleSchema = z.enum(["musician", "producer"]);
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9_]+$/);
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
  featureLimits: z.record(z.string(), z.number()).nullable().optional(),
  maxSeats: z.number().int().nullable().optional(),
  monthlyPrice: z.number(),
  name: z.string(),
  stripeAnnualPriceId: z.string().nullable().optional(),
  stripeMonthlyPriceId: z.string().nullable().optional(),
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
  artistUsername: z.string().nullable().optional(),
  assetStatus: z.string().nullable().optional(),
  bpm: z.number().int().nullable().optional(),
  catalogItemType: catalogItemTypeSchema.optional(),
  collaboratorCount: z.number().int().default(0),
  coverArtUrl: z.string().nullable().optional(),
  duration: z.string(),
  fileAvailability: z
    .object({
      adlibs: z.boolean(),
      coverArt: z.boolean(),
      instrumental: z.boolean(),
      master: z.boolean(),
      reference: z.boolean(),
      session: z.boolean(),
      vocals: z.number().int(),
    })
    .optional(),
  genre: z.string(),
  id: z.string(),
  isForSale: z.boolean(),
  isPublic: z.boolean().optional(),
  lyricsStatus: z
    .enum(["missing", "generating", "pending_review", "approved", "failed"])
    .default("missing"),
  musicalKey: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
  playbackUrl: z.string().nullable().optional(),
  plays: z.number(),
  price: z.number().nullable(),
  priceCents: z.number().int().nullable().optional(),
  productionStatus: z
    .enum(["demo", "mixed", "mastered", "complete"])
    .optional(),
  purchaseMode: purchaseModeSchema.optional(),
  releaseAt: z.string().nullable().optional(),
  releaseStrategy: z.enum(["private", "publish_when_ready", "scheduled"]),
  slug: z.string(),
  title: z.string(),
  updatedAt: z.string().optional(),
});

export const dashboardAssetSchema = z.object({
  assetKind: z.string(),
  bucketName: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  id: z.string(),
  metadata: z.unknown().nullable().optional(),
  mimeType: z.string().nullable(),
  objectKey: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  status: z.string(),
  storageProvider: z.enum(["r2", "mux", "external"]),
});

export const dashboardCollaboratorSchema = z.object({
  avatarUrl: z.string().nullable().optional(),
  canDelete: z.boolean(),
  canEdit: z.boolean(),
  canUpload: z.boolean(),
  email: z.string().nullable().optional(),
  id: z.string(),
  name: z.string().nullable().optional(),
  role: z.string(),
  status: z.string(),
});

export const trackDashboardDetailSchema = trackSummarySchema.extend({
  assets: dashboardAssetSchema.array(),
  collaborators: dashboardCollaboratorSchema.array(),
  createdAt: z.string(),
  description: z.string().nullable().optional(),
  lyrics: z.string().nullable().optional(),
  lyricsRevision: z
    .object({
      approvedAt: z.string().nullable(),
      id: z.string(),
      language: z.string().nullable(),
      sourceType: z.enum([
        "artist",
        "collaborator",
        "machine_transcription",
        "fan_submission",
        "import",
      ]),
      status: z.enum(["pending_review", "approved", "rejected"]),
      timedLines: z
        .array(
          z.object({
            endMs: z.number().int().nonnegative(),
            startMs: z.number().int().nonnegative(),
            text: z.string().min(1),
          })
        )
        .nullable(),
    })
    .nullable()
    .optional(),
});

export const timedLyricsLineSchema = z
  .object({
    endMs: z.number().int().nonnegative(),
    startMs: z.number().int().nonnegative(),
    text: z.string().min(1),
  })
  .refine((line) => line.endMs > line.startMs, {
    message: "A lyric line must end after it starts.",
  });

export const createLyricsRevisionBodySchema = z.object({
  language: z.string().min(2).default("en"),
  text: z.string().min(1),
  timedLines: z.array(timedLyricsLineSchema).optional(),
});

export const reviewLyricsRevisionBodySchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export const lyricsRevisionSchema = z.object({
  approvedAt: z.string().nullable(),
  id: z.string(),
  language: z.string().nullable(),
  sourceType: z.enum([
    "artist",
    "collaborator",
    "machine_transcription",
    "fan_submission",
    "import",
  ]),
  status: z.enum(["pending_review", "approved", "rejected"]),
  text: z.string(),
  timedLines: z.array(timedLyricsLineSchema).nullable(),
  trackId: z.string(),
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
  collaboratorCount: z.number().int().default(0),
  coverArtUrl: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  id: z.string(),
  isPublic: z.boolean(),
  progress: z.number().int().min(0).max(100).default(0),
  projectType: z.enum(["album", "ep", "single"]),
  releaseDate: z.string().nullable().optional(),
  slug: z.string(),
  status: z.enum(["draft", "scheduled", "released", "archived"]),
  title: z.string(),
  trackCount: z.number(),
  updatedAt: z.string().optional(),
});

export const projectDashboardDetailSchema = projectSummarySchema.extend({
  assets: dashboardAssetSchema.array(),
  collaborators: dashboardCollaboratorSchema.array(),
  tracks: trackSummarySchema.array(),
});

export const videoSummarySchema = z.object({
  description: z.string().nullable().optional(),
  externalPlaybackUrl: z.string().url().nullable().optional(),
  id: z.string(),
  muxPlaybackId: z.string().nullable(),
  playbackPolicy: z.enum(["public", "signed"]),
  sourceProjectId: z.string().nullable().optional(),
  sourceProvider: z.enum(["mux", "external"]).default("mux"),
  sourceTrackId: z.string().nullable().optional(),
  status: z.string(),
  thumbnailUrl: z.string().nullable().optional(),
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

export const sellerStatusSchema = z.object({
  accountLinkUrl: z.string().url().nullable(),
  chargesEnabled: z.boolean(),
  detailsSubmitted: z.boolean(),
  onboardingStatus: z.enum([
    "not_started",
    "pending",
    "restricted",
    "enabled",
    "rejected",
  ]),
  payoutsEnabled: z.boolean(),
  stripeAccountId: z.string().nullable(),
});

export const sellerOnboardingResponseSchema = z.object({
  accountLinkUrl: z.string().url(),
  onboardingStatus: z.enum([
    "not_started",
    "pending",
    "restricted",
    "enabled",
    "rejected",
  ]),
});

export const createSellerAccountLinkBodySchema = z.object({
  refreshUrl: z.url().optional(),
  returnUrl: z.url().optional(),
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

export const usernameAvailabilityQuerySchema = z.object({
  username: usernameSchema,
});

export const usernameAvailabilityResponseSchema = z.object({
  available: z.boolean(),
  message: z.string(),
  reason: z.enum(["available", "reserved", "taken"]),
  username: usernameSchema,
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
  username: usernameSchema,
  youtubeUrl: z.url().optional(),
});

export const onboardingResponseSchema = z.object({
  checkoutUrl: z.string().url().nullable(),
  message: z.string(),
  requiresCheckout: z.boolean(),
  setupRequired: z.boolean(),
  workspaceId: z.string().nullable(),
});

export const onboardingFanBodySchema = z.object({
  city: z.string().min(1),
  genrePreferences: z.array(z.string()).min(3),
  selectedPlanCode: z.string(),
  state: z.string().min(1),
  username: usernameSchema,
});

export const createTrackBodySchema = z.object({
  assetIds: z.array(z.string()).default([]),
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
  sourceObjectKey: z.string().optional(),
  title: z.string().min(1),
});

export const updateTrackBodySchema = createTrackBodySchema.partial();

export const createTrackAssetBodySchema = z.object({
  assetKind: z.enum([
    "cover_art",
    "master",
    "vocal_stem",
    "clean",
    "alternate_mix",
    "artwork",
    "booklet",
    "tagged_mp3",
    "untagged_wav",
    "stems",
    "midi",
    "license_pdf",
    "instrumental",
    "verse_vocal",
    "adlib",
    "session_file",
    "reference_audio",
    "variant_audio",
  ]),
  bucketName: z.string().optional(),
  durationMs: z.number().int().optional(),
  metadata: z.unknown().optional(),
  mimeType: z.string().optional(),
  objectKey: z.string().min(1),
  sizeBytes: z.number().int().optional(),
  status: z
    .enum([
      "pending",
      "uploading",
      "uploaded",
      "processing",
      "ready",
      "failed",
      "deleted",
    ])
    .default("uploaded"),
  storageProvider: z.enum(["r2", "mux", "external"]).default("r2"),
});

export const trackProcessingStatusSchema = z.object({
  jobId: z.string().nullable(),
  message: z.string(),
  status: z.enum([
    "queued",
    "submitted",
    "processing",
    "completed",
    "failed",
    "expired",
  ]),
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
  assetIds: z.array(z.string()).default([]),
  collaboratorNames: z.array(z.string()).default([]),
  description: z.string().optional(),
  isPublic: z.boolean().default(true),
  newTracks: z
    .array(
      z.object({
        assetId: z.string().optional(),
        genre: z.string().min(1),
        title: z.string().min(1),
      })
    )
    .default([]),
  projectType: z.enum(["album", "ep", "single"]),
  releaseDate: z.string().optional(),
  title: z.string().min(1),
  trackIds: z.array(z.string()).default([]),
});

export const updateProjectBodySchema = createProjectBodySchema.partial();

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
  playbackPolicy: z.literal("public").default("public"),
  sourceProjectId: z.string().optional(),
  sourceTrackId: z.string().min(1).optional(),
  title: z.string().min(1),
  videoKind: z
    .enum([
      "music_video",
      "promo",
      "teaser",
      "battle_replay",
      "battle_clip",
      "live_recording",
    ])
    .default("music_video"),
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

export const battleEligibilityBodySchema = z.object({
  trackIds: z.array(z.string().min(1)).min(1),
});

export const battleEligibilitySchema = z.object({
  eligible: z.boolean(),
  tracks: z.array(
    z.object({
      lyricsRevisionId: z.string().nullable(),
      ready: z.boolean(),
      reason: z.string().nullable(),
      trackId: z.string(),
    })
  ),
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
