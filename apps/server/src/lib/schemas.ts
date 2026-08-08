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

export const adminOverviewSchema = z.object({
  commerce: z.object({
    grossRevenueCents: z.number().int(),
    platformFeeCents: z.number().int(),
    successfulTransactions: z.number().int(),
  }),
  content: z.object({
    communities: z.number().int(),
    listeningParties: z.number().int(),
    openVerses: z.number().int(),
    projects: z.number().int(),
    tracks: z.number().int(),
    videos: z.number().int(),
  }),
  operations: z.object({
    activeOpenVerses: z.number().int(),
    publishedTracks: z.number().int(),
    readyVideos: z.number().int(),
    releasedProjects: z.number().int(),
    scheduledListeningParties: z.number().int(),
  }),
  people: z.object({
    admins: z.number().int(),
    artists: z.number().int(),
    bannedUsers: z.number().int(),
    fans: z.number().int(),
    users: z.number().int(),
  }),
});

export const adminFinanceSummarySchema = z.object({
  platformFeeCents: z.number().int(),
  successfulTransactionCents: z.number().int(),
  transactionCount: z.number().int(),
});

export const adminAccessSchema = z.object({
  isAdmin: z.boolean(),
});

export const platformSettingsSchema = z.object({
  defaultExploreRegion: z.string(),
  defaultExploreRegionType: z.enum(["north-america", "global"]),
  useGlobalExploreHome: z.boolean(),
});

export const updatePlatformSettingsBodySchema =
  platformSettingsSchema.partial();

export const liveExperienceKindSchema = z.enum(["battle", "party", "stream"]);

export const liveScheduleModeSchema = z.enum(["asap", "scheduled"]);

export const liveParticipantRoleSchema = z.enum([
  "artist",
  "host",
  "listener",
  "viewer",
]);

export const battlePhaseSchema = z.enum([
  "matching",
  "lobby",
  "round_active",
  "voting",
  "between_rounds",
  "completed",
]);

export const createLiveExperienceBodySchema = z.object({
  battleKitId: z.string().optional(),
  description: z.string().optional(),
  format: z.enum(["best_of_3", "best_of_5", "best_of_7"]).optional(),
  genre: z.string().optional(),
  kind: liveExperienceKindSchema,
  opponentUsername: z.string().optional(),
  playlistId: z.string().optional(),
  projectId: z.string().optional(),
  scheduleMode: liveScheduleModeSchema.default("asap"),
  scheduledStartAt: z.string().optional(),
  source: z.enum(["browser", "obs", "playlist"]).optional(),
  title: z.string().min(1),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
});

export const joinLiveExperienceBodySchema = z.object({
  phase: battlePhaseSchema.optional(),
  role: liveParticipantRoleSchema.default("viewer"),
});

export const liveSessionLockCheckBodySchema = z.object({
  candidateEndsAt: z.string().optional(),
  candidateStartsAt: z.string(),
  locks: z
    .object({
      endsAt: z.string().nullable().optional(),
      experienceId: z.string(),
      kind: liveExperienceKindSchema,
      startsAt: z.string(),
      status: z.enum(["scheduled", "live"]),
    })
    .array()
    .default([]),
});

export const battleBotActionBodySchema = z.object({
  action: z.enum([
    "open_lobby",
    "snapshot_voters",
    "close_voting",
    "move_lobby_to_round",
    "complete_round",
  ]),
  participants: z
    .object({
      id: z.string(),
      inLobby: z.boolean().optional(),
      voted: z.boolean().optional(),
    })
    .array()
    .default([]),
  phase: battlePhaseSchema.optional(),
});

export const adminPaymentPlanSchema = z.object({
  annualPriceCents: z.number().int().nullable(),
  audience: z.enum(["artist", "fan"]),
  code: z.string(),
  envAnnualKey: z.string().nullable(),
  envAnnualPriceId: z.string().nullable(),
  envMonthlyKey: z.string().nullable(),
  envMonthlyPriceId: z.string().nullable(),
  isActive: z.boolean(),
  maxSeats: z.number().int().nullable(),
  monthlyPriceCents: z.number().int(),
  name: z.string(),
  stripeAnnualPriceId: z.string().nullable(),
  stripeMonthlyPriceId: z.string().nullable(),
});

export const adminStripePriceSchema = z.object({
  active: z.boolean(),
  currency: z.string(),
  id: z.string(),
  interval: z.string().nullable(),
  lookupKey: z.string().nullable(),
  planCode: z.string().nullable(),
  productId: z.string(),
  productName: z.string(),
  unitAmount: z.number().int().nullable(),
});

export const adminRecentTransactionSchema = z.object({
  amountCents: z.number().int(),
  createdAt: z.string(),
  currency: z.string(),
  id: z.string(),
  platformFeeCents: z.number().int(),
  status: z.string(),
  transactionType: z.string(),
});

export const adminPaymentsOverviewSchema = z.object({
  configuredCheckoutPlans: z.number().int(),
  planCount: z.number().int(),
  plans: adminPaymentPlanSchema.array(),
  recentTransactions: adminRecentTransactionSchema.array(),
  stripeConfigured: z.boolean(),
  stripePrices: adminStripePriceSchema.array(),
  totals: z.object({
    grossRevenueCents: z.number().int(),
    platformFeeCents: z.number().int(),
    successfulTransactions: z.number().int(),
  }),
});

export const adminSyncStripePlansBodySchema = z.object({
  planCodes: z.string().array().optional(),
});

export const adminSyncStripePlansResponseSchema = z.object({
  message: z.string(),
  results: z
    .object({
      annualPriceId: z.string().nullable(),
      code: z.string(),
      monthlyPriceId: z.string().nullable(),
      productId: z.string().nullable(),
      status: z.enum(["created", "skipped"]),
    })
    .array(),
});

export const adminImportStripePlanBodySchema = z.object({
  annualPriceId: z.string().trim().optional(),
  code: z.string().trim().min(1),
  monthlyPriceId: z.string().trim().optional(),
});

export const userSummarySchema = z.object({
  accountType: z.enum(["artist", "fan"]),
  avatarUrl: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  displayName: z.string(),
  headerUrl: z.string().nullable().optional(),
  id: z.string(),
  links: z
    .object({
      appleMusic: z.string().url().optional(),
      instagram: z.string().url().optional(),
      personalSite: z.string().url().optional(),
      soundcloud: z.string().url().optional(),
      spotify: z.string().url().optional(),
      tiktok: z.string().url().optional(),
      twitter: z.string().url().optional(),
      youtube: z.string().url().optional(),
    })
    .optional(),
  onboardingCompletedAt: z.string().nullable().optional(),
  proAffiliation: z.string().nullable().optional(),
  proMemberId: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  songwriterLegalName: z.string().nullable().optional(),
  stageName: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
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
  canOperatePaidCommunity: z.boolean(),
  canReceivePayouts: z.boolean(),
  canSellProducts: z.boolean(),
  canViewLiveBattles: z.boolean(),
  canVoteLiveBattles: z.boolean(),
  canWatchCreatorStreams: z.boolean(),
  canWatchVod: z.boolean(),
  isPremium: z.boolean(),
  referenceId: z.string().nullable(),
  status: z.string().nullable(),
});

export const notificationSettingsSchema = z.object({
  emailCollaborations: z.boolean(),
  emailComments: z.boolean(),
  emailFollowers: z.boolean(),
  emailSales: z.boolean(),
  emailTrackProcessing: z.boolean(),
  pushMentions: z.boolean(),
  pushMessages: z.boolean(),
  pushReleases: z.boolean(),
});

export const updateNotificationSettingsBodySchema =
  notificationSettingsSchema.partial();

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
  links: z
    .object({
      appleMusic: z.string().optional(),
      instagram: z.string().optional(),
      personalSite: z.string().optional(),
      soundcloud: z.string().optional(),
      spotify: z.string().optional(),
      tiktok: z.string().optional(),
      twitter: z.string().optional(),
      youtube: z.string().optional(),
    })
    .optional(),
  proAffiliation: z.string().optional(),
  proMemberId: z.string().optional(),
  songwriterLegalName: z.string().optional(),
  stageName: z.string().optional(),
  state: z.string().optional(),
});

export const planSchema = z.object({
  annualPriceCents: z.number().int().nullable(),
  audience: z.enum(["artist", "fan"]),
  code: z.string(),
  entitlements: z.record(
    z.string(),
    z.union([z.boolean(), z.number(), z.string()])
  ),
  maxSeats: z.number().int().nullable().optional(),
  monthlyPriceCents: z.number().int(),
  name: z.string(),
});

export const artistSummarySchema = z.object({
  avatarUrl: z.string().nullable().optional(),
  battleCount: z.number().int().nonnegative().optional(),
  bio: z.string().nullable().optional(),
  coverImageUrl: z.string().nullable().optional(),
  followers: z.number(),
  genre: z.string(),
  id: z.string(),
  joinedAt: z.string().optional(),
  links: z
    .object({
      apple: z.string().url().optional(),
      instagram: z.string().url().optional(),
      personalSite: z.string().url().optional(),
      soundcloud: z.string().url().optional(),
      spotify: z.string().url().optional(),
      tiktok: z.string().url().optional(),
      twitter: z.string().url().optional(),
      youtube: z.string().url().optional(),
    })
    .optional(),
  location: z.string(),
  name: z.string(),
  projectCount: z.number().int().nonnegative().optional(),
  rank: z
    .union([z.number().int().positive(), z.string()])
    .nullable()
    .optional(),
  roles: artistRoleSchema.array().default(["musician"]),
  state: z.string().nullable().optional(),
  trackCount: z.number().int().nonnegative().optional(),
  username: z.string(),
  verified: z.boolean(),
  weeklyPlays: z.number().int().nonnegative().optional(),
});

export const publicExploreQuerySchema = z.object({
  genre: z.string().trim().max(80).default("all"),
  limit: z.coerce.number().int().positive().max(100).default(24),
  page: z.coerce.number().int().positive().default(1),
  region: z.string().trim().max(80).default("us-arkansas"),
  regionType: z.enum(["north-america", "global"]).default("north-america"),
  scope: z.enum(["dashboard", "public"]).default("dashboard"),
  sort: z.string().trim().max(80).default("rank-asc"),
});

export const artistRankingQuerySchema = publicExploreQuerySchema.extend({
  category: z.enum(["rising", "new", "top"]).default("top"),
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
  downloadsAllowed: z.boolean().default(true).optional(),
  downloadUrl: z.string().nullable().optional(),
  downloadsRequireFirstPlay: z.boolean().default(false).optional(),
  downloadsRequirePurchase: z.boolean().default(true).optional(),
  isForSale: z.boolean(),
  isPublic: z.boolean().optional(),
  isrc: z.string().nullable().optional(),
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
  regionSlug: z.string().nullable().optional(),
  slug: z.string(),
  streamingLinks: z
    .object({
      appleMusic: z.string().url().optional(),
      spotify: z.string().url().optional(),
      youtube: z.string().url().optional(),
    })
    .default({})
    .optional(),
  title: z.string(),
  updatedAt: z.string().optional(),
});

export const discoverHomeResponseSchema = z.object({
  featuredArtists: artistSummarySchema.array(),
  featuredBattles: z.lazy(() => battleSummarySchema.array()),
  featuredTracks: trackSummarySchema.array(),
  settings: platformSettingsSchema,
});

export const playbackSourceTypeSchema = z.enum([
  "artist_profile",
  "album",
  "playlist",
  "library",
  "search",
  "semantic_search",
  "recommendation",
  "state_discovery",
  "national_discovery",
  "global_discovery",
  "map",
  "community",
  "listening_party",
  "battle",
  "vod",
  "purchase_library",
  "share",
  "external_deep_link",
]);

export const createPlaybackSessionBodySchema = z.object({
  city: z.string().trim().max(120).optional(),
  clientType: z.string().trim().max(80).optional(),
  clientVersion: z.string().trim().max(80).optional(),
  countryCode: z.string().trim().max(2).optional(),
  regionCode: z.string().trim().max(80).optional(),
  sourceId: z.string().trim().max(160).optional(),
  sourceType: playbackSourceTypeSchema.default("library"),
});

export const playbackSessionResponseSchema = z.object({
  canQualify: z.boolean(),
  durationSeconds: z.number().int().positive().nullable(),
  id: z.string(),
});

export const playbackProgressBodySchema = z.object({
  durationSeconds: z.number().positive().optional(),
  ended: z.boolean().default(false),
  isMuted: z.boolean().default(false),
  playedSeconds: z.number().nonnegative(),
});

export const playbackProgressResponseSchema = z.object({
  qualifiedStreamId: z.string().nullable(),
  result: z.enum([
    "already_qualified",
    "duplicate",
    "ineligible",
    "not_ready",
    "qualified",
  ]),
});

export const publicSearchQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(12),
  q: z.string().trim().max(120).default(""),
  state: z.string().trim().max(80).optional(),
  type: z.enum(["all", "artists", "tracks", "projects"]).default("all"),
});

export const publicSearchResultSchema = z.object({
  artists: artistSummarySchema.array(),
  projects: z
    .object({
      artistName: z.string(),
      artistUsername: z.string().nullable(),
      coverArtUrl: z.string().nullable(),
      id: z.string(),
      projectType: z.enum(["album", "ep", "mixtape", "single"]),
      releaseDate: z.string().nullable(),
      slug: z.string(),
      state: z.string().nullable(),
      status: z.enum(["draft", "scheduled", "released", "archived"]),
      title: z.string(),
      trackCount: z.number().int(),
    })
    .array(),
  tracks: trackSummarySchema.array(),
});

export const dashboardAssetSchema = z.object({
  assetKind: z.string(),
  bucketName: z.string().nullable(),
  downloadUrl: z.string().nullable().optional(),
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
  downloadUrl: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  fileName: z.string().nullable().optional(),
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
    "cover_art",
  ]),
  label: z.string(),
  subtitle: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
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
  downloadsAllowed: z.boolean().default(true).optional(),
  downloadsRequireFirstPlay: z.boolean().default(false).optional(),
  downloadsRequirePurchase: z.boolean().default(true).optional(),
  isForSale: z.boolean().default(false),
  isOwned: z.boolean().default(false),
  isPurchasable: z.boolean(),
  isStreamable: z.boolean(),
  isrc: z.string().nullable().optional(),
  licenseOptions: catalogLicenseOptionSchema.array().default([]),
  musicalKey: z.string().nullable().optional(),
  playbackUrl: z.string().nullable().optional(),
  priceCents: z.number().int().nullable(),
  priceLabel: z.string(),
  purchaseMode: purchaseModeSchema,
  regionSlug: z.string().nullable().optional(),
  slug: z.string(),
  streamCount: z.string().nullable().optional(),
  streamingLinks: z
    .object({
      appleMusic: z.string().url().optional(),
      spotify: z.string().url().optional(),
      youtube: z.string().url().optional(),
    })
    .default({})
    .optional(),
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
  projectType: z.enum(["album", "ep", "mixtape", "single"]),
  releaseDate: z.string().nullable().optional(),
  slug: z.string(),
  status: z.enum(["draft", "scheduled", "released", "archived"]),
  streamingLinks: z
    .object({
      appleMusic: z.string().url().optional(),
      spotify: z.string().url().optional(),
      youtube: z.string().url().optional(),
    })
    .default({})
    .optional(),
  title: z.string(),
  trackCount: z.number(),
  updatedAt: z.string().optional(),
});

export const projectDashboardDetailSchema = projectSummarySchema.extend({
  assets: dashboardAssetSchema.array(),
  collaborators: dashboardCollaboratorSchema.array(),
  tracks: trackSummarySchema.array(),
});

export const listeningPartySummarySchema = z.object({
  description: z.string().nullable(),
  endedAt: z.string().nullable(),
  hostUserId: z.string(),
  id: z.string(),
  liveRoomId: z.string().nullable(),
  organizationId: z.string().nullable(),
  playbackMode: z.enum(["artist_hosted", "programmed_release"]),
  projectId: z.string(),
  scheduledStartAt: z.string(),
  startedAt: z.string().nullable(),
  status: z.enum(["scheduled", "live", "ended", "canceled"]),
  title: z.string(),
});

export const createListeningPartyBodySchema = z.object({
  description: z.string().max(2000).optional(),
  playbackMode: z
    .enum(["artist_hosted", "programmed_release"])
    .default("artist_hosted"),
  projectId: z.string().min(1),
  scheduledStartAt: z.string().datetime(),
  title: z.string().min(1).max(140),
});

export const videoSummarySchema = z.object({
  creatorName: z.string().optional(),
  creatorUsername: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  duration: z.string().optional(),
  externalPlaybackUrl: z.string().url().nullable().optional(),
  genre: z.string().nullable().optional(),
  id: z.string(),
  muxPlaybackId: z.string().nullable(),
  playbackPolicy: z.enum(["public", "signed"]),
  releaseAt: z.string().nullable().optional(),
  regionSlug: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
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
  viewCount: z.string().optional(),
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
  participantAvatarUrl: z.string().nullable(),
  participantName: z.string().nullable(),
  participantUsername: z.string().nullable(),
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

export const friendSummarySchema = z.object({
  avatarUrl: z.string().nullable(),
  email: z.string().nullable(),
  id: z.string(),
  lastInteractionAt: z.string().nullable(),
  name: z.string(),
  relationship: z.enum(["friend", "collaborator", "following"]),
  role: z.string().nullable(),
  username: z.string().nullable(),
});

export const battleSummarySchema = z.object({
  featuredRank: z.number().int().positive().nullable().optional(),
  format: z.enum(["best_of_3", "best_of_5", "best_of_7"]),
  genre: z.string(),
  id: z.string(),
  isFeatured: z.boolean().default(false),
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
  watchedCount: z.number().optional(),
});

export const libraryRecentTrackSchema = z.object({
  artist: z.string(),
  artistSlug: z.string(),
  cover: z.string(),
  duration: z.string(),
  id: z.string(),
  lastPlayed: z.string(),
  regionSlug: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
  timesPlayed: z.number().int().nonnegative(),
  title: z.string(),
});

export const librarySavedTrackSchema = z.object({
  artist: z.string(),
  artistSlug: z.string(),
  cover: z.string(),
  duration: z.string(),
  genre: z.string(),
  id: z.string(),
  regionSlug: z.string().nullable().optional(),
  savedAt: z.string(),
  slug: z.string().nullable().optional(),
  title: z.string(),
});

export const libraryWatchedItemSchema = z.object({
  creator: z.string(),
  creatorSlug: z.string(),
  duration: z.string(),
  id: z.string(),
  regionSlug: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
  thumbnail: z.string(),
  title: z.string(),
  type: z.enum(["battle", "community", "party", "stream", "video"]),
  watchedAt: z.string(),
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
  productId: z.string().optional(),
  productType: commerceProductTypeSchema,
  purchaseMode: purchaseModeSchema,
  purchasedAt: z.string(),
  regionSlug: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
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

export const onboardingArtistBodySchema = z
  .object({
    appleMusicUrl: z.string().optional(),
    avatarObjectKey: z.string().min(1).optional(),
    avatarUrl: z.url().optional(),
    city: z.string().min(1),
    instagramHandle: z.string().optional(),
    primaryGenre: z.string().min(1),
    proAffiliation: z.string().default("None"),
    proMemberId: z.string().optional(),
    roles: artistRoleSchema.array().min(1).default(["musician"]),
    selectedPlanCode: z.enum([
      "artist_free",
      "soundkit_premium_artist",
      "artist_team",
    ]),
    songwriterLegalName: z.string().optional(),
    spotifyUrl: z.string().optional(),
    state: z.string().min(1),
    teamInviteEmails: z.array(z.email()).default([]),
    tiktokHandle: z.string().optional(),
    twitterHandle: z.string().optional(),
    username: usernameSchema,
    youtubeUrl: z.string().optional(),
  })
  .refine(
    ({ avatarObjectKey, avatarUrl }) =>
      Boolean(avatarObjectKey) === Boolean(avatarUrl),
    {
      message: "Profile picture storage metadata must be provided together.",
      path: ["avatarUrl"],
    }
  );

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
  selectedPlanCode: z.enum(["fan_free", "soundkit_premium_fan", "fan_family"]),
  state: z.string().min(1),
  username: usernameSchema,
});

export const trackCollaboratorInputSchema = z.object({
  inviteEmail: z.string().optional(),
  name: z.string().min(1).optional(),
  role: z.enum([
    "artist",
    "producer",
    "vocalist",
    "engineer",
    "songwriter",
    "manager",
    "social_media_manager",
    "marketing",
    "family_member",
  ]),
  userId: z.string().min(1).optional(),
});

/** Standard single download price (USD). */
export const SINGLE_TRACK_PRICE_USD = 1.29;
export const SINGLE_TRACK_PRICE_CENTS = 129;

export const createTrackBodySchema = z.object({
  assetIds: z.array(z.string()).default([]),
  bpm: z.number().int().positive().optional(),
  catalogItemType: z.enum(["single", "beat", "instrumental"]).default("single"),
  collaborators: z.array(trackCollaboratorInputSchema).default([]),
  description: z.string().optional(),
  downloadsAllowed: z.boolean().default(true),
  downloadsRequireFirstPlay: z.boolean().default(false),
  downloadsRequirePurchase: z.boolean().default(true),
  genre: z.string().min(1),
  isForSale: z.boolean(),
  isOpenVerse: z.boolean().default(false),
  isPublic: z.boolean(),
  isrc: z.string().optional(),
  musicalKey: z.string().optional(),
  price: z.number().nonnegative().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  productionStatus: z.enum(["demo", "mixed", "mastered", "complete"]),
  purchaseMode: purchaseModeSchema.default("digital_download"),
  releaseAt: z.string().optional(),
  releaseStrategy: z.enum(["private", "publish_when_ready", "scheduled"]),
  sourceObjectKey: z.string().optional(),
  streamingLinks: z
    .object({
      appleMusic: z.string().optional(),
      spotify: z.string().optional(),
      youtube: z.string().optional(),
    })
    .default({}),
  title: z.string().min(1),
});

export const settleTrackBodySchema = z.object({
  isPublic: z.boolean(),
  productionStatus: z.enum(["demo", "mixed", "mastered", "complete"]),
  releaseAt: z.string().optional(),
  releaseStrategy: z.enum(["private", "publish_when_ready", "scheduled"]),
  requireCoverArt: z.boolean().default(false),
});

export const peopleSearchQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(20).default(8),
  q: z.string().trim().min(1).max(80),
});

export const peopleSearchResultSchema = z.object({
  avatarUrl: z.string().nullable(),
  displayName: z.string(),
  email: z.string().nullable(),
  stageName: z.string().nullable(),
  userId: z.string(),
  username: z.string(),
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

export const openVerseQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  genre: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().positive().max(50).default(10),
  q: z.string().trim().max(120).optional(),
});

export const openVerseListingSchema = z.object({
  artistName: z.string(),
  artistUsername: z.string().nullable(),
  bpm: z.number().int().nullable(),
  closesAt: z.string().nullable(),
  coverArtUrl: z.string().nullable(),
  createdAt: z.string(),
  description: z.string().nullable(),
  genre: z.string(),
  genreSlug: z.string(),
  id: z.string(),
  maxSubmissions: z.number().int(),
  musicalKey: z.string().nullable(),
  playbackUrl: z.string().nullable(),
  slotEndsAtMs: z.number().int().nullable(),
  slotStartsAtMs: z.number().int().nullable(),
  status: z.enum(["open", "closed", "fulfilled", "archived"]),
  submissionCount: z.number().int(),
  title: z.string(),
  trackId: z.string(),
  trackTitle: z.string(),
});

export const openVersePageSchema = z.object({
  items: openVerseListingSchema.array(),
  nextCursor: z.string().nullable(),
});

export const createOpenVerseBodySchema = z.object({
  closesAt: z.string().datetime().optional(),
  description: z.string().max(2000).optional(),
  maxSubmissions: z.number().int().positive().max(500).default(50),
  slotEndsAtMs: z.number().int().nonnegative().optional(),
  slotStartsAtMs: z.number().int().nonnegative().optional(),
  title: z.string().min(1).max(140),
  trackId: z.string().min(1),
});

export const createOpenVerseSubmissionBodySchema = z.object({
  assetId: z.string().min(1).optional(),
  message: z.string().max(2000).optional(),
});

export const openVerseSubmissionSchema = z.object({
  assetId: z.string().nullable(),
  createdAt: z.string(),
  id: z.string(),
  listingId: z.string(),
  message: z.string().nullable(),
  status: z.enum([
    "submitted",
    "shortlisted",
    "accepted",
    "declined",
    "withdrawn",
  ]),
  submitterUserId: z.string(),
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
  projectId: z.string().nullable().optional(),
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
        durationMs: z.number().int().nonnegative().optional(),
        fileName: z.string().optional(),
        genre: z.string().min(1),
        mimeType: z.string().optional(),
        sizeBytes: z.number().int().nonnegative().optional(),
        title: z.string().min(1),
      })
    )
    .default([]),
  projectType: z.enum(["album", "ep", "mixtape", "single"]),
  releaseDate: z.string().optional(),
  streamingLinks: z
    .object({
      appleMusic: z.url().optional(),
      spotify: z.url().optional(),
      youtube: z.url().optional(),
    })
    .default({}),
  title: z.string().min(1),
  trackIds: z.array(z.string()).default([]),
});

export const updateProjectBodySchema = createProjectBodySchema.partial();

export const createVideoBodySchema = z.object({
  description: z.string().optional(),
  externalPlaybackUrl: z.url().optional(),
  genre: z.string().min(1).optional(),
  isPublic: z.boolean().default(true),
  playbackPolicy: z.enum(["public", "signed"]).default("public"),
  releaseAt: z
    .string()
    .datetime()
    .optional()
    .or(z.literal("").transform(() => undefined)),
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
  genre: z.string().min(1).optional(),
  isPublic: z.boolean().default(true),
  playbackPolicy: z.literal("public").default("public"),
  releaseAt: z
    .string()
    .datetime()
    .optional()
    .or(z.literal("").transform(() => undefined)),
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

export const videoCommentSchema = z.object({
  authorAvatarUrl: z.string().nullable().optional(),
  authorName: z.string().nullable().optional(),
  body: z.string(),
  createdAt: z.string(),
  id: z.string(),
  userId: z.string(),
});

export const createVideoCommentBodySchema = z.object({
  body: z.string().min(1).max(2000),
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

export const liveRoomChatBodySchema = z.object({
  message: z.string().min(1).max(500),
  userName: z.string().max(80).optional(),
});

export const liveRoomVoteBodySchema = z.object({
  artistId: z.string().min(1),
  roundId: z.string().min(1),
  voterId: z.string().max(120).optional(),
});

export const liveRoomLyricsLineSchema = z.object({
  endMs: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(),
  text: z.string(),
});

export const liveRoomTrackSchema = z.object({
  artistName: z.string(),
  coverArtUrl: z.string(),
  durationMs: z.number().int().positive(),
  id: z.string(),
  lyrics: liveRoomLyricsLineSchema.array(),
  status: z.enum(["played", "playing", "queued"]),
  title: z.string(),
});

export const liveRoomStateSchema = z.object({
  battle: z
    .object({
      artists: z.tuple([
        z.object({
          avatarUrl: z.string(),
          id: z.string(),
          isMuted: z.boolean(),
          name: z.string(),
          roundsWon: z.number().int().nonnegative(),
          stagePosition: z.enum(["left", "right"]),
          verified: z.boolean(),
        }),
        z.object({
          avatarUrl: z.string(),
          id: z.string(),
          isMuted: z.boolean(),
          name: z.string(),
          roundsWon: z.number().int().nonnegative(),
          stagePosition: z.enum(["left", "right"]),
          verified: z.boolean(),
        }),
      ]),
      currentRoundId: z.string(),
      rounds: z
        .object({
          artistATrack: liveRoomTrackSchema,
          artistBTrack: liveRoomTrackSchema,
          id: z.string(),
          isTiebreaker: z.boolean(),
          number: z.number().int().positive(),
          status: z.enum(["complete", "live", "queued", "voting"]),
          voteTotals: z.record(z.string(), z.number().int().nonnegative()),
          winnerArtistId: z.string().nullable(),
        })
        .array(),
      tiePolicy: z.string(),
    })
    .optional(),
  chat: z
    .object({
      id: z.string(),
      message: z.string(),
      sentAt: z.string(),
      userName: z.string(),
    })
    .array(),
  createdAt: z.string(),
  currentTrackId: z.string(),
  hostName: z.string(),
  id: z.string(),
  kind: z.enum(["battle", "party", "stream"]),
  status: z.enum(["ended", "live", "upcoming"]),
  summary: z.string(),
  title: z.string(),
  tracklist: liveRoomTrackSchema.array(),
  viewerCount: z.number().int().nonnegative(),
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
