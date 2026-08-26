/* oxlint-disable one-var, sort-vars, unicorn/max-nested-calls */
import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";

import {
  analyticsTimeseriesQuerySchema,
  battleEligibilityBodySchema,
  createFriendRequestBodySchema,
  createWorkspaceInvitationBodySchema,
  playlistSchema,
  respondFriendRequestBodySchema,
  adminImportStripePlanBodySchema,
  adminSyncStripePlansBodySchema,
  backfillTrackDurationsBodySchema,
  createChallengeBodySchema,
  createConversationBodySchema,
  createLiveExperienceBodySchema,
  createListeningPartyBodySchema,
  createLyricsRevisionBodySchema,
  createMessageBodySchema,
  createOpenVerseBodySchema,
  createOpenVerseSubmissionBodySchema,
  createPlaybackSessionBodySchema,
  createProjectBodySchema,
  createSellerAccountLinkBodySchema,
  createTrackAssetBodySchema,
  createTrackBodySchema,
  createVideoBodySchema,
  createVideoCommentBodySchema,
  directVideoUploadBodySchema,
  finalizeTrackUploadBodySchema,
  battleBotActionBodySchema,
  joinLiveExperienceBodySchema,
  liveSessionLockCheckBodySchema,
  onboardingArtistBodySchema,
  onboardingFanBodySchema,
  onboardingResponseSchema,
  updateOnboardingStateBodySchema,
  openVerseQuerySchema,
  playbackProgressBodySchema,
  artistRankingQuerySchema,
  profileUpdateBodySchema,
  publicExploreQuerySchema,
  peopleSearchQuerySchema,
  publicSearchQuerySchema,
  reviewLyricsRevisionBodySchema,
  battleKitQuerySchema,
  createBattleKitBodySchema,
  updateBattleKitBodySchema,
  settleTrackBodySchema,
  updateBattleChallengeBodySchema,
  updateNotificationSettingsBodySchema,
  updateProjectBodySchema,
  updateTrackBodySchema,
  usernameAvailabilityQuerySchema,
} from "./lib/schemas";
import type {
  adminAccessSchema,
  adminFinanceSummarySchema,
  adminGenreSchema,
  adminPaymentsOverviewSchema,
  adminOverviewSchema,
  adminSyncStripePlansResponseSchema,
  analyticsAudienceSchema,
  analyticsLiveImpactSchema,
  analyticsLocationsSchema,
  analyticsOverviewSchema,
  analyticsSourcesSchema,
  analyticsTimeseriesSchema,
  analyticsTracksResponseSchema,
  artistEarningsOverviewSchema,
  backfillTrackDurationsResponseSchema,
  trackDurationBackfillStatusSchema,
  artistProfileMediaSchema,
  artistSummarySchema,
  battleChallengesResponseSchema,
  battleEligibilitySchema,
  battleKitSchema,
  battleSummarySchema,
  conversationSummarySchema,
  directVideoUploadResponseSchema,
  entitlementSummarySchema,
  friendRequestSummarySchema,
  friendSummarySchema,
  networkResponseSchema,
  peopleSearchResultSchema,
  libraryOverviewSchema,
  libraryRecentTrackSchema,
  librarySavedTrackSchema,
  libraryWatchedItemSchema,
  listeningPartySummarySchema,
  lyricsRevisionSchema,
  meResponseSchema,
  messageSchema,
  mediaProcessingStatusSchema,
  notificationSettingsSchema,
  openVerseListingSchema,
  openVersePageSchema,
  openVerseSubmissionSchema,
  playbackProgressResponseSchema,
  playbackSessionResponseSchema,
  planSchema,
  projectDashboardDetailSchema,
  publicSearchResultSchema,
  projectSummarySchema,
  purchasedCatalogDetailSchema,
  purchasedCatalogItemSchema,
  sellerOnboardingResponseSchema,
  sellerStatusSchema,
  trackDashboardDetailSchema,
  trackProcessingStatusSchema,
  trackSummarySchema,
  usernameAvailabilityResponseSchema,
  videoCommentSchema,
  videoSummarySchema,
  messageResponseSchema,
  workspaceDetailSchema,
  workspaceSummarySchema,
  onboardingStateSchema,
} from "./lib/schemas";

const jsonValidator = <Schema extends z.ZodType>(schema: Schema) =>
    validator("json", (value) => schema.parse(value) as z.infer<Schema>),
  genericJsonBodySchema = z.record(z.string(), z.unknown()),
  genericQueryValidator = validator("query", (value) =>
    z
      .record(z.string(), z.union([z.string(), z.array(z.string())]))
      .parse(value)
  ),
  battleOpponentSchema = z.object({
    genre: z.string().nullable(),
    name: z.string(),
    username: z.string(),
  }),
  checkoutBodySchema = z.object({
    cancelUrl: z.url(),
    customerType: z.enum(["organization", "user"]).default("organization"),
    planCode: z.string(),
    referenceId: z.string().optional(),
    seats: z.number().int().positive().optional(),
    successUrl: z.url(),
  }),
  billingPortalBodySchema = z.object({
    customerType: z.enum(["organization", "user"]).default("user"),
    referenceId: z.string().optional(),
    returnUrl: z.url(),
  }),
  billingPortalResponseSchema = z.object({
    portalUrl: z.string().url().nullable(),
    setupRequired: z.boolean(),
  }),
  checkoutResponseSchema = onboardingResponseSchema.pick({
    checkoutUrl: true,
    requiresCheckout: true,
    setupRequired: true,
  }),
  playlistDetailSchema = z.object({
    playlist: playlistSchema,
    tracks: z.array(
      z.object({
        artist: z.string(),
        artistSlug: z.string(),
        cover: z.string(),
        duration: z.string(),
        genre: z.string().nullable(),
        id: z.string(),
        regionSlug: z.string().nullable(),
        slug: z.string().nullable(),
        title: z.string(),
      })
    ),
  }),
  cloudflareStreamBodySchema = z.object({
    title: z.string().optional(),
  }),
  genreCatalogItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
  notificationSummarySchema = z.object({
    createdAt: z.string(),
    id: z.string(),
    link: z.string().nullable(),
    message: z.string(),
    read: z.boolean(),
    title: z.string(),
    type: z.string(),
  }),
  notificationsQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
  notificationStatsSchema = z.object({
    unreadCount: z.number().int().nonnegative(),
  }),
  notificationsResponseSchema = z.object({
    items: z.array(notificationSummarySchema),
    nextCursor: z.string().nullable(),
    unreadCount: z.number().int().nonnegative(),
  }),
  followResponseSchema = z.object({
    followed: z.boolean(),
    followerCount: z.number().int().nonnegative(),
  }),
  sellerAccountSessionSchema = z.object({ clientSecret: z.string() }),
  embeddingBackfillSchema = z.object({ indexed: z.number().int() }),
  embeddingStatusSchema = z.object({
    byEntityType: z.record(z.string(), z.number()),
    total: z.number(),
  }),
  semanticSearchResultSchema = z.object({
    entityId: z.string(),
    entityType: z.enum(["artist", "lyrics", "project", "track", "video"]),
  }),
  communityAuthorSchema = z.object({
    avatarUrl: z.string().nullable(),
    name: z.string(),
    username: z.string(),
  }),
  communitySchema = z.object({
    artist: communityAuthorSchema,
    artistUserId: z.string(),
    coverImageUrl: z.string().nullable(),
    currency: z.string(),
    description: z.string().nullable(),
    genre: z
      .object({ id: z.string(), name: z.string(), slug: z.string() })
      .nullable(),
    id: z.string(),
    isMember: z.boolean(),
    isOwner: z.boolean(),
    memberCount: z.number().int().nonnegative(),
    monthlyPriceCents: z.number().int().nonnegative(),
    name: z.string(),
    slug: z.string(),
    updatedAt: z.string(),
  }),
  communityInputSchema = z.object({
    coverImageUrl: z.string().url().nullable().optional(),
    description: z.string().max(2000).optional(),
    genreId: z.string().nullable().optional(),
    monthlyPriceCents: z.number().int().nonnegative(),
    name: z.string().min(1).max(100),
  }),
  communityCheckoutSchema = z.object({
    cancelUrl: z.string().url(),
    communityId: z.string(),
    successUrl: z.string().url(),
  }),
  communityPostSchema = z.object({
    author: communityAuthorSchema,
    body: z.string().nullable(),
    createdAt: z.string(),
    id: z.string(),
    isPinned: z.boolean(),
    mediaUrl: z.string().nullable(),
    metadata: z.unknown().nullable(),
    postType: z.enum(["text", "image", "audio", "video", "poll"]),
    userId: z.string(),
  }),
  communityMessageSchema = z.object({
    author: communityAuthorSchema,
    body: z.string(),
    createdAt: z.string(),
    id: z.string(),
    userId: z.string(),
  }),
  communityMemberSchema = z.object({
    avatarUrl: z.string().nullable(),
    joinedAt: z.string(),
    name: z.string(),
    role: z.enum(["owner", "moderator", "member"]),
    userId: z.string(),
    username: z.string(),
  }),
  communityBanSchema = z.object({
    avatarUrl: z.string().nullable(),
    bannedAt: z.string(),
    name: z.string(),
    reason: z.string().nullable(),
    userId: z.string(),
    username: z.string(),
  }),
  liveExperienceSummarySchema = z
    .object({
      id: z.string(),
      kind: z.enum(["battle", "party", "stream"]),
      roomHref: z.string(),
      status: z.string(),
      title: z.string(),
    })
    .passthrough(),
  liveExperienceResponseSchema = z
    .object({
      defaults: z.object({}).passthrough(),
      experience: liveExperienceSummarySchema,
      lock: z.object({}).passthrough(),
      notifications: z.array(z.object({}).passthrough()),
      realtime: z.object({ id: z.string() }).passthrough(),
      streamInput: z
        .object({
          id: z.string(),
          playbackUrl: z.string(),
          rtmpsKey: z.string(),
          rtmpsUrl: z.string(),
          srtKey: z.string(),
          srtUrl: z.string(),
          status: z.string(),
          title: z.string(),
        })
        .nullable(),
    })
    .passthrough(),
  liveParticipantResponseSchema = z
    .object({
      participant: z
        .object({
          authToken: z.string(),
          meetingId: z.string(),
          participantId: z.string(),
          presetName: z.string(),
        })
        .passthrough(),
      setupScreen: z.boolean(),
    })
    .passthrough(),
  publicLiveExperienceQuerySchema = publicExploreQuerySchema.partial().extend({
    kind: z.enum(["battle", "party", "stream"]).optional(),
  }),
  liveExperienceActionResponseSchema = z
    .object({
      action: z.string().optional(),
      battleBot: z.object({}).passthrough().optional(),
      conflict: z.unknown().optional(),
      experienceId: z.string().optional(),
      hasConflict: z.boolean().optional(),
      message: z.string().optional(),
      snapshot: z.object({}).passthrough().optional(),
    })
    .passthrough();

export const rpcContract = new Hono()
  .get(
    "/v1/live/experiences/public",
    validator("query", (value) => publicLiveExperienceQuerySchema.parse(value)),
    (c) =>
      c.json(
        [] as {
          creatorAvatar: string | null;
          creatorName: string | null;
          endsAt: string | null;
          genre: string | null;
          id: string;
          kind: "battle" | "party" | "stream";
          source: string;
          startsAt: string;
          status: string;
          title: string;
          viewerCount: number;
        }[]
      )
  )
  .get("/v1/admin/access", (c) =>
    c.json({} as z.infer<typeof adminAccessSchema>)
  )
  .get("/v1/admin/overview", (c) =>
    c.json({} as z.infer<typeof adminOverviewSchema>)
  )
  .post(
    "/v1/admin/tracks/backfill-durations",
    jsonValidator(backfillTrackDurationsBodySchema),
    (c) => c.json({} as z.infer<typeof backfillTrackDurationsResponseSchema>)
  )
  .get("/v1/admin/tracks/backfill-durations/status", (c) =>
    c.json({} as z.infer<typeof trackDurationBackfillStatusSchema>)
  )
  .get("/v1/admin/finance/payments", (c) =>
    c.json({} as z.infer<typeof adminPaymentsOverviewSchema>)
  )
  .post(
    "/v1/admin/finance/payments/sync-plans",
    jsonValidator(adminSyncStripePlansBodySchema),
    (c) => c.json({} as z.infer<typeof adminSyncStripePlansResponseSchema>)
  )
  .post(
    "/v1/admin/finance/payments/import-plan",
    jsonValidator(adminImportStripePlanBodySchema),
    (c) => c.json({} as z.infer<typeof adminPaymentsOverviewSchema>)
  )
  .get("/v1/me/", (c) => c.json({} as z.infer<typeof meResponseSchema>))
  .patch("/v1/me/profile", jsonValidator(profileUpdateBodySchema), (c) =>
    c.json({ message: "" })
  )
  .get("/v1/me/notification-settings", (c) =>
    c.json({} as z.infer<typeof notificationSettingsSchema>)
  )
  .patch(
    "/v1/me/notification-settings",
    jsonValidator(updateNotificationSettingsBodySchema),
    (c) => c.json({} as z.infer<typeof notificationSettingsSchema>)
  )
  .get("/v1/me/entitlements", (c) =>
    c.json({} as z.infer<typeof entitlementSummarySchema>)
  )
  .patch(
    "/v1/me/workspace",
    jsonValidator(z.object({ name: z.string() })),
    (c) => c.json({} as z.infer<typeof workspaceSummarySchema>)
  )
  .get("/v1/me/workspace", (c) =>
    c.json({} as z.infer<typeof workspaceDetailSchema>)
  )
  .post(
    "/v1/me/workspace/invitations",
    jsonValidator(createWorkspaceInvitationBodySchema),
    (c) => c.json({} as z.infer<typeof workspaceDetailSchema>, 201)
  )
  .delete("/v1/me/workspace/invitations/:invitationId", (c) =>
    c.json({} as z.infer<typeof workspaceDetailSchema>)
  )
  .delete("/v1/me/workspace/members/:memberId", (c) =>
    c.json({} as z.infer<typeof workspaceDetailSchema>)
  )
  .get("/v1/onboarding/state", (c) =>
    c.json(null as z.infer<typeof onboardingStateSchema> | null)
  )
  .post(
    "/v1/onboarding/state",
    jsonValidator(updateOnboardingStateBodySchema),
    (c) => c.json({} as z.infer<typeof onboardingStateSchema>)
  )
  .get(
    "/v1/onboarding/username-availability",
    validator("query", (value) => usernameAvailabilityQuerySchema.parse(value)),
    (c) => c.json({} as z.infer<typeof usernameAvailabilityResponseSchema>)
  )
  .post(
    "/v1/onboarding/artist",
    jsonValidator(onboardingArtistBodySchema),
    (c) => c.json({} as z.infer<typeof onboardingResponseSchema>, 201)
  )
  .post("/v1/onboarding/fan", jsonValidator(onboardingFanBodySchema), (c) =>
    c.json({} as z.infer<typeof onboardingResponseSchema>, 201)
  )
  .get("/v1/billing/plans", (c) => c.json([] as z.infer<typeof planSchema>[]))
  .get("/v1/admin/genres", (c) =>
    c.json([] as z.infer<typeof adminGenreSchema>[])
  )
  .post("/v1/billing/checkout", jsonValidator(checkoutBodySchema), (c) =>
    c.json({} as z.infer<typeof checkoutResponseSchema>)
  )
  .post("/v1/billing/portal", jsonValidator(billingPortalBodySchema), (c) =>
    c.json({} as z.infer<typeof billingPortalResponseSchema>)
  )
  .get(
    "/v1/artists/",
    validator("query", (value) =>
      artistRankingQuerySchema.partial().parse(value)
    ),
    (c) => c.json([] as z.infer<typeof artistSummarySchema>[])
  )
  .get("/v1/artists/:username", (c) =>
    c.json({} as z.infer<typeof artistSummarySchema>)
  )
  .get("/v1/artists/:username/media", (c) =>
    c.json({} as z.infer<typeof artistProfileMediaSchema>)
  )
  .get("/v1/messages/friends", (c) =>
    c.json([] as z.infer<typeof friendSummarySchema>[])
  )
  .get(
    "/v1/messages/people",
    validator("query", (value) => peopleSearchQuerySchema.parse(value)),
    (c) => c.json([] as z.infer<typeof peopleSearchResultSchema>[])
  )
  .get("/v1/messages/conversations", (c) =>
    c.json([] as z.infer<typeof conversationSummarySchema>[])
  )
  .post(
    "/v1/messages/conversations",
    jsonValidator(createConversationBodySchema),
    (c) => c.json({} as z.infer<typeof conversationSummarySchema>, 201)
  )
  .get("/v1/messages/conversations/:conversationId/messages", (c) =>
    c.json([] as z.infer<typeof messageSchema>[])
  )
  .post("/v1/messages/conversations/:conversationId/read", (c) =>
    c.json({ readAt: "", success: true })
  )
  .post(
    "/v1/messages/conversations/:conversationId/messages",
    jsonValidator(createMessageBodySchema),
    (c) => c.json({} as z.infer<typeof messageSchema>, 201)
  )
  .get("/v1/messages/friend-requests", (c) =>
    c.json([] as z.infer<typeof friendRequestSummarySchema>[])
  )
  .post(
    "/v1/messages/friend-requests",
    jsonValidator(createFriendRequestBodySchema),
    (c) => c.json({} as z.infer<typeof friendRequestSummarySchema>, 201)
  )
  .patch(
    "/v1/messages/friend-requests/:requestId",
    jsonValidator(respondFriendRequestBodySchema),
    (c) => c.json({} as z.infer<typeof friendRequestSummarySchema>)
  )
  .get(
    "/v1/search",
    validator("query", (value) => publicSearchQuerySchema.parse(value)),
    (c) => c.json({} as z.infer<typeof publicSearchResultSchema>)
  )
  .get("/v1/discover/genres", (c) =>
    c.json([] as z.infer<typeof genreCatalogItemSchema>[])
  )
  .get(
    "/v1/tracks/",
    validator("query", (value) =>
      publicExploreQuerySchema.partial().parse(value)
    ),
    (c) => c.json([] as z.infer<typeof trackSummarySchema>[])
  )
  .post("/v1/tracks/", jsonValidator(createTrackBodySchema), (c) =>
    c.json({} as z.infer<typeof trackSummarySchema>, 201)
  )
  .post(
    "/v1/tracks/:trackId/playback-sessions",
    jsonValidator(createPlaybackSessionBodySchema),
    (c) => c.json({} as z.infer<typeof playbackSessionResponseSchema>, 201)
  )
  .post(
    "/v1/tracks/:trackId/playback-sessions/:sessionId/progress",
    jsonValidator(playbackProgressBodySchema),
    (c) => c.json({} as z.infer<typeof playbackProgressResponseSchema>)
  )
  .post(
    "/v1/tracks/:trackId/playback-sessions/:sessionId/end",
    jsonValidator(playbackProgressBodySchema.partial()),
    (c) => c.json({} as z.infer<typeof playbackProgressResponseSchema>)
  )
  .get("/v1/tracks/:trackId", (c) =>
    c.json({} as z.infer<typeof trackDashboardDetailSchema>)
  )
  .patch("/v1/tracks/:trackId", jsonValidator(updateTrackBodySchema), (c) =>
    c.json({} as z.infer<typeof trackDashboardDetailSchema>)
  )
  .delete("/v1/tracks/:trackId", (c) =>
    c.json({} as z.infer<typeof messageResponseSchema>)
  )
  .post(
    "/v1/tracks/:trackId/assets",
    jsonValidator(createTrackAssetBodySchema),
    (c) => c.json({} as z.infer<typeof trackDashboardDetailSchema>)
  )
  .post(
    "/v1/tracks/:trackId/settle",
    jsonValidator(settleTrackBodySchema),
    (c) => c.json({} as z.infer<typeof trackDashboardDetailSchema>)
  )
  .post(
    "/v1/tracks/:trackId/finalize-upload",
    jsonValidator(finalizeTrackUploadBodySchema),
    (c) => c.json({} as z.infer<typeof trackDashboardDetailSchema>)
  )
  .get("/v1/tracks/:trackId/processing", (c) =>
    c.json({} as z.infer<typeof mediaProcessingStatusSchema>)
  )
  .post("/v1/tracks/:trackId/processing/retry", (c) =>
    c.json({} as z.infer<typeof mediaProcessingStatusSchema>, 202)
  )
  .post("/v1/tracks/:trackId/process", (c) =>
    c.json({} as z.infer<typeof trackProcessingStatusSchema>)
  )
  .post("/v1/tracks/:trackId/pre-save", (c) =>
    c.json({} as z.infer<typeof messageResponseSchema>)
  )
  .get("/v1/tracks/:trackId/lyrics", (c) =>
    c.json(null as z.infer<typeof lyricsRevisionSchema> | null)
  )
  .post(
    "/v1/tracks/:trackId/lyrics",
    jsonValidator(createLyricsRevisionBodySchema),
    (c) => c.json({} as z.infer<typeof lyricsRevisionSchema>, 201)
  )
  .post(
    "/v1/tracks/:trackId/lyrics/suggestions",
    jsonValidator(createLyricsRevisionBodySchema),
    (c) => c.json({} as z.infer<typeof lyricsRevisionSchema>, 201)
  )
  .patch(
    "/v1/tracks/:trackId/lyrics/:lyricsId",
    jsonValidator(reviewLyricsRevisionBodySchema),
    (c) => c.json({} as z.infer<typeof lyricsRevisionSchema>)
  )
  .get("/v1/projects/", (c) =>
    c.json([] as z.infer<typeof projectSummarySchema>[])
  )
  .get(
    "/v1/projects/public",
    validator("query", (value) =>
      publicExploreQuerySchema
        .extend({
          q: z.string().trim().max(120).optional(),
          type: z.enum(["album", "ep", "mixtape", "single"]).optional(),
        })
        .partial()
        .parse(value)
    ),
    (c) => c.json([] as z.infer<typeof projectSummarySchema>[])
  )
  .get("/v1/projects/public/:projectId", (c) =>
    c.json({} as z.infer<typeof projectDashboardDetailSchema>)
  )
  .post("/v1/projects/", jsonValidator(createProjectBodySchema), (c) =>
    c.json({} as z.infer<typeof projectSummarySchema>, 201)
  )
  .get("/v1/projects/:projectId", (c) =>
    c.json({} as z.infer<typeof projectDashboardDetailSchema>)
  )
  .patch(
    "/v1/projects/:projectId",
    jsonValidator(updateProjectBodySchema),
    (c) => c.json({} as z.infer<typeof projectDashboardDetailSchema>)
  )
  .get(
    "/v1/listening-parties/",
    validator("query", (value) =>
      publicExploreQuerySchema.partial().parse(value)
    ),
    (c) => c.json([] as z.infer<typeof listeningPartySummarySchema>[])
  )
  .post(
    "/v1/listening-parties/",
    jsonValidator(createListeningPartyBodySchema),
    (c) => c.json({} as z.infer<typeof listeningPartySummarySchema>, 201)
  )
  .get(
    "/v1/battles/",
    validator("query", (value) =>
      publicExploreQuerySchema.partial().parse(value)
    ),
    (c) => c.json([] as z.infer<typeof battleSummarySchema>[])
  )
  .get("/v1/battles/challenges", (c) =>
    c.json({} as z.infer<typeof battleChallengesResponseSchema>)
  )
  .get(
    "/v1/battles/kits",
    validator("query", (value) => battleKitQuerySchema.parse(value)),
    (c) => c.json([] as z.infer<typeof battleKitSchema>[])
  )
  .get("/v1/battles/kits/:kitId", (c) =>
    c.json({} as z.infer<typeof battleKitSchema>)
  )
  .post("/v1/battles/kits", jsonValidator(createBattleKitBodySchema), (c) =>
    c.json({} as z.infer<typeof battleKitSchema>, 201)
  )
  .patch(
    "/v1/battles/kits/:kitId",
    jsonValidator(updateBattleKitBodySchema),
    (c) => c.json({} as z.infer<typeof battleKitSchema>)
  )
  .delete("/v1/battles/kits/:kitId", (c) => c.json({ message: "" }))
  .get("/v1/library/overview", (c) =>
    c.json({} as z.infer<typeof libraryOverviewSchema>)
  )
  .get("/v1/library/purchases", (c) =>
    c.json([] as z.infer<typeof purchasedCatalogItemSchema>[])
  )
  .get("/v1/library/playlists", (c) =>
    c.json([] as z.infer<typeof playlistSchema>[])
  )
  .get("/v1/library/recent", (c) =>
    c.json([] as z.infer<typeof libraryRecentTrackSchema>[])
  )
  .get("/v1/library/saved", (c) =>
    c.json([] as z.infer<typeof librarySavedTrackSchema>[])
  )
  .post("/v1/library/saved/:trackId", (c) =>
    c.json({ saved: true, trackId: "" })
  )
  .delete("/v1/library/saved/:trackId", (c) =>
    c.json({ saved: false, trackId: "" })
  )
  .get("/v1/library/purchases/:purchaseId", (c) =>
    c.json({} as z.infer<typeof purchasedCatalogDetailSchema>)
  )
  .post(
    "/v1/library/playlists",
    jsonValidator(
      z.object({
        clientPlaylistId: z.string().uuid().optional(),
        description: z.string().optional(),
        isPublic: z.boolean().optional(),
        title: z.string().min(1),
      })
    ),
    (c) => c.json({} as z.infer<typeof playlistSchema>, 201)
  )
  .get("/v1/library/playlists/:id", (c) =>
    c.json({} as z.infer<typeof playlistDetailSchema>)
  )
  .delete("/v1/library/playlists/:id", (c) => c.json({ deleted: true }))
  .post(
    "/v1/library/playlists/:id/tracks",
    jsonValidator(z.object({ trackId: z.string() })),
    (c) => c.json({ added: true })
  )
  .delete("/v1/library/playlists/:id/tracks/:trackId", (c) =>
    c.json({ removed: true })
  )
  .get("/v1/library/watched", (c) =>
    c.json([] as z.infer<typeof libraryWatchedItemSchema>[])
  )
  .post(
    "/v1/battles/challenge",
    jsonValidator(createChallengeBodySchema),
    (c) => c.json({ message: "" }, 201)
  )
  .patch(
    "/v1/battles/challenges/:challengeId",
    jsonValidator(updateBattleChallengeBodySchema),
    (c) => c.json({} as z.infer<typeof messageResponseSchema>)
  )
  .get("/v1/battles/stats", (c) =>
    c.json(
      [] as {
        trackId: string;
        trackName: string;
        wins: number;
        losses: number;
        saves: number;
        downloads: number;
        purchases: number;
      }[]
    )
  )
  .get("/v1/battles/track-history/:trackId", (c) =>
    c.json(
      {} as {
        trackId: string;
        trackName: string;
        stats: {
          wins: number;
          losses: number;
          saves: number;
          downloads: number;
          purchases: number;
        };
        history: {
          battleId: string;
          battleTitle: string;
          roundNumber: number;
          opponentTrackId: string | null;
          opponentTrackName: string | null;
          votesFor: number;
          votesAgainst: number;
          status: string;
          winningTrackId: string | null;
          isTiebreaker: boolean;
          createdAt: string;
          viewerCount: number;
        }[];
      }
    )
  )
  .post(
    "/v1/live/experiences/",
    jsonValidator(createLiveExperienceBodySchema),
    (c) => c.json({} as z.infer<typeof liveExperienceResponseSchema>, 201)
  )
  .get("/v1/live/experiences/me", (c) =>
    c.json(
      [] as {
        createdAt: string;
        createdByUserId: string;
        endsAt: string | null;
        genre: string | null;
        id: string;
        kind: "battle" | "party" | "stream";
        meetingId: string | null;
        playbackMode: string;
        playlistId: string | null;
        projectId: string | null;
        roomHref?: string;
        source: "browser" | "obs" | "playlist";
        startsAt: string;
        status: "ended" | "live" | "scheduled";
        streamInputId: string | null;
        title: string;
        viewerCount: number;
        visibility: "premium_only" | "private" | "public";
      }[]
    )
  )
  .get("/v1/live/experiences/:experienceId", (c) =>
    c.json({
      id: "",
      kind: "stream" as const,
      playbackUrl: null,
      playerUrl: null,
      source: "obs",
      status: "scheduled",
      streamInputId: null,
      title: "",
      viewerCount: 0,
      visibility: "public",
    })
  )
  .delete("/v1/live/experiences/:experienceId", (c) => c.json({ message: "" }))
  .post(
    "/v1/live/experiences/:experienceId/join",
    jsonValidator(joinLiveExperienceBodySchema),
    (c) => c.json({} as z.infer<typeof liveParticipantResponseSchema>, 201)
  )
  .post(
    "/v1/live/experiences/:experienceId/battlebot",
    jsonValidator(battleBotActionBodySchema),
    (c) => c.json({} as z.infer<typeof liveExperienceActionResponseSchema>, 201)
  )
  .post(
    "/v1/live/experiences/:experienceId/session-locks/check",
    jsonValidator(liveSessionLockCheckBodySchema),
    (c) => c.json({} as z.infer<typeof liveExperienceActionResponseSchema>, 200)
  )
  .post(
    "/v1/live/cloudflare-stream",
    jsonValidator(cloudflareStreamBodySchema),
    (c) =>
      c.json(
        {} as {
          id: string;
          playbackUrl: string;
          rtmpsKey: string;
          rtmpsUrl: string;
          srtKey: string;
          srtUrl: string;
          status: string;
          title: string;
        }
      )
  )
  .delete("/v1/live/cloudflare-stream/:streamId", (c) =>
    c.json({ message: "Cloudflare Stream input stopped." })
  )
  .get("/v1/live/cloudflare-stream/:streamId", (c) =>
    c.json(
      {} as {
        id: string;
        playbackUrl: string;
        rtmpsKey: string;
        rtmpsUrl: string;
        srtKey: string;
        srtUrl: string;
        status: string;
      }
    )
  )
  .get(
    "/v1/notifications/",
    validator("query", (value) => notificationsQuerySchema.parse(value)),
    (c) => c.json({} as z.infer<typeof notificationsResponseSchema>)
  )
  .get("/v1/notifications/summary", (c) =>
    c.json({} as z.infer<typeof notificationStatsSchema>)
  )
  .post("/v1/notifications/:notificationId/read", (c) =>
    c.json({ success: true })
  )
  .post("/v1/notifications/read-all", (c) => c.json({ success: true }))
  .post("/v1/notifications/clear", (c) => c.json({ success: true }))
  .get(
    "/v1/open-verses/",
    validator("query", (value) => openVerseQuerySchema.parse(value)),
    (c) => c.json({} as z.infer<typeof openVersePageSchema>)
  )
  .post("/v1/open-verses/", jsonValidator(createOpenVerseBodySchema), (c) =>
    c.json({} as z.infer<typeof openVerseListingSchema>, 201)
  )
  .get("/v1/open-verses/:listingId", (c) =>
    c.json({} as z.infer<typeof openVerseListingSchema>)
  )
  .get("/v1/network/", (c) =>
    c.json({} as z.infer<typeof networkResponseSchema>)
  )
  .post(
    "/v1/open-verses/:listingId/submissions",
    jsonValidator(createOpenVerseSubmissionBodySchema),
    (c) => c.json({} as z.infer<typeof openVerseSubmissionSchema>, 201)
  )
  .get(
    "/v1/videos/",
    validator("query", (value) =>
      publicExploreQuerySchema.partial().parse(value)
    ),
    (c) => c.json([] as z.infer<typeof videoSummarySchema>[])
  )
  .post("/v1/videos/", jsonValidator(createVideoBodySchema), (c) =>
    c.json({} as z.infer<typeof videoSummarySchema>, 201)
  )
  .post(
    "/v1/videos/direct-upload",
    jsonValidator(directVideoUploadBodySchema),
    (c) => c.json({} as z.infer<typeof directVideoUploadResponseSchema>, 201)
  )
  .delete("/v1/videos/:videoId", (c) =>
    c.json({} as z.infer<typeof messageResponseSchema>)
  )
  .get("/v1/videos/:videoId", (c) =>
    c.json({} as z.infer<typeof videoSummarySchema>)
  )
  .get("/v1/videos/:videoId/comments", (c) =>
    c.json([] as z.infer<typeof videoCommentSchema>[])
  )
  .post(
    "/v1/videos/:videoId/comments",
    jsonValidator(createVideoCommentBodySchema),
    (c) => c.json({} as z.infer<typeof videoCommentSchema>, 201)
  )
  .get(
    "/v1/communities/",
    validator("query", (value) =>
      z
        .object({
          access: z.enum(["all", "free", "paid"]).optional(),
          genre: z.string().optional(),
          q: z.string().optional(),
          sort: z
            .enum(["activity-desc", "members-desc", "newest-desc", "name-asc"])
            .optional(),
        })
        .parse(value)
    ),
    (c) => c.json([] as z.infer<typeof communitySchema>[])
  )
  .post("/v1/communities/", jsonValidator(communityInputSchema), (c) =>
    c.json({} as z.infer<typeof communitySchema>, 201)
  )
  .get("/v1/communities/:communityId", (c) =>
    c.json({} as z.infer<typeof communitySchema>)
  )
  .patch(
    "/v1/communities/:communityId",
    jsonValidator(communityInputSchema.partial()),
    (c) => c.json({} as z.infer<typeof communitySchema>)
  )
  .post("/v1/communities/:communityId/join", (c) =>
    c.json({ message: "" }, 201)
  )
  .get("/v1/communities/:communityId/posts", (c) =>
    c.json([] as z.infer<typeof communityPostSchema>[])
  )
  .post(
    "/v1/communities/:communityId/posts",
    jsonValidator(
      z.object({
        body: z.string().optional(),
        mediaUrl: z.string().url().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        postType: z.enum(["text", "image", "audio", "video", "poll"]),
      })
    ),
    (c) => c.json({} as z.infer<typeof communityPostSchema>, 201)
  )
  .get("/v1/communities/:communityId/messages", (c) =>
    c.json([] as z.infer<typeof communityMessageSchema>[])
  )
  .post(
    "/v1/communities/:communityId/messages",
    jsonValidator(
      z.object({ body: z.string(), clientMessageId: z.string().optional() })
    ),
    (c) => c.json({} as z.infer<typeof communityMessageSchema>, 201)
  )
  .get("/v1/communities/:communityId/members", (c) =>
    c.json([] as z.infer<typeof communityMemberSchema>[])
  )
  .get("/v1/communities/:communityId/bans", (c) =>
    c.json([] as z.infer<typeof communityBanSchema>[])
  )
  .patch(
    "/v1/communities/:communityId/members/:userId",
    jsonValidator(z.object({ role: z.enum(["moderator", "member"]) })),
    (c) => c.json({ message: "" })
  )
  .delete("/v1/communities/:communityId/members/:userId", (c) =>
    c.json({ message: "" })
  )
  .post(
    "/v1/communities/:communityId/members/:userId/ban",
    jsonValidator(z.object({ reason: z.string().optional() })),
    (c) => c.json({ message: "" })
  )
  .delete("/v1/communities/:communityId/bans/:userId", (c) =>
    c.json({ message: "" })
  )
  .get("/v1/communities/:communityId/analytics", (c) =>
    c.json({
      activeSubscribers: 0,
      canceledSubscribers: 0,
      churnedSubscribers: 0,
      memberCount: 0,
      monthlyRecurringRevenueCents: 0,
    })
  )
  .post(
    "/v1/community-billing/checkout",
    jsonValidator(communityCheckoutSchema),
    (c) => c.json({ checkoutUrl: null as string | null, setupRequired: false })
  )
  .get("/v1/admin/finance/summary", (c) =>
    c.json({} as z.infer<typeof adminFinanceSummarySchema>)
  )
  .get("/v1/admin/finance/payments/users", genericQueryValidator, (c) =>
    c.json([] as Record<string, unknown>[])
  )
  .get("/v1/admin/finance/payments/coupons", (c) =>
    c.json([] as Record<string, unknown>[])
  )
  .post(
    "/v1/admin/finance/payments/coupons",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>, 201)
  )
  .delete("/v1/admin/finance/payments/coupons/:id", (c) =>
    c.json({} as Record<string, unknown>)
  )
  .post(
    "/v1/admin/finance/payments/grant-premium",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .get("/v1/admin/open-verses", genericQueryValidator, (c) =>
    c.json([] as Record<string, unknown>[])
  )
  .get("/v1/admin/regions", (c) => c.json({} as Record<string, unknown>))
  .post("/v1/admin/genres", jsonValidator(genericJsonBodySchema), (c) =>
    c.json({} as Record<string, unknown>, 201)
  )
  .get("/v1/admin/embeddings/status", (c) =>
    c.json({} as z.infer<typeof embeddingStatusSchema>)
  )
  .post(
    "/v1/admin/embeddings/backfill",
    validator("query", (value) =>
      z.object({ limit: z.string().optional() }).parse(value)
    ),
    (c) => c.json({} as z.infer<typeof embeddingBackfillSchema>)
  )
  .get("/v1/ads/admin/campaigns", genericQueryValidator, (c) =>
    c.json([] as Record<string, unknown>[])
  )
  .post("/v1/ads/admin/campaigns", jsonValidator(genericJsonBodySchema), (c) =>
    c.json({} as Record<string, unknown>, 201)
  )
  .patch(
    "/v1/ads/admin/campaigns/:campaignId/status",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .get("/v1/ads/campaigns", (c) => c.json([] as Record<string, unknown>[]))
  .post("/v1/ads/campaigns", jsonValidator(genericJsonBodySchema), (c) =>
    c.json({} as Record<string, unknown>, 201)
  )
  .get("/v1/ads/serve", genericQueryValidator, (c) =>
    c.json({} as Record<string, unknown>)
  )
  .post("/v1/ads/event", jsonValidator(genericJsonBodySchema), (c) =>
    c.json({} as Record<string, unknown>)
  )
  .get("/v1/ads/wallet", (c) => c.json({} as Record<string, unknown>))
  .get(
    "/v1/analytics/timeseries",
    validator("query", (value) => analyticsTimeseriesQuerySchema.parse(value)),
    (c) => c.json({} as z.infer<typeof analyticsTimeseriesSchema>)
  )
  .get("/v1/analytics/tracks", (c) =>
    c.json({} as z.infer<typeof analyticsTracksResponseSchema>)
  )
  .get("/v1/analytics/audience", (c) =>
    c.json({} as z.infer<typeof analyticsAudienceSchema>)
  )
  .get("/v1/analytics/sources", (c) =>
    c.json({} as z.infer<typeof analyticsSourcesSchema>)
  )
  .get("/v1/analytics/locations", (c) =>
    c.json({} as z.infer<typeof analyticsLocationsSchema>)
  )
  .get("/v1/analytics/live-impact", (c) =>
    c.json({} as z.infer<typeof analyticsLiveImpactSchema>)
  )
  .get("/v1/analytics/earnings", (c) =>
    c.json({} as z.infer<typeof artistEarningsOverviewSchema>)
  )
  .get("/v1/auth/capabilities", (c) => c.json({} as Record<string, unknown>))
  .get("/v1/battles/:battleId", (c) =>
    c.json({} as z.infer<typeof battleSummarySchema>)
  )
  .get(
    "/v1/battles/opponents",
    validator("query", (value) =>
      z
        .object({ genre: z.string().optional(), q: z.string().optional() })
        .parse(value)
    ),
    (c) => c.json([] as z.infer<typeof battleOpponentSchema>[])
  )
  .post(
    "/v1/battles/eligibility",
    jsonValidator(battleEligibilityBodySchema),
    (c) => c.json({} as z.infer<typeof battleEligibilitySchema>)
  )
  .get("/v1/billing/subscription", (c) => c.json({} as Record<string, unknown>))
  .get("/v1/cart", (c) => c.json({} as Record<string, unknown>))
  .delete("/v1/cart", (c) => c.json({} as Record<string, unknown>))
  .post("/v1/cart/claim", jsonValidator(genericJsonBodySchema), (c) =>
    c.json({} as Record<string, unknown>)
  )
  .post("/v1/cart/items", jsonValidator(genericJsonBodySchema), (c) =>
    c.json({} as Record<string, unknown>, 201)
  )
  .patch(
    "/v1/cart/items/:cartItemId",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .delete("/v1/cart/items/:cartItemId", (c) =>
    c.json({} as Record<string, unknown>)
  )
  .get("/v1/listening-parties/sources", (c) =>
    c.json([] as Record<string, unknown>[])
  )
  .get("/v1/me/workspaces", (c) =>
    c.json([] as z.infer<typeof workspaceSummarySchema>[])
  )
  .get("/v1/open-verses/:listingId/access-requests", (c) =>
    c.json([] as Record<string, unknown>[])
  )
  .get("/v1/open-verses/:listingId/access-requests/me", (c) =>
    c.json({} as Record<string, unknown>)
  )
  .post(
    "/v1/open-verses/:listingId/access-requests",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>, 201)
  )
  .patch(
    "/v1/open-verses/:listingId/access-requests/:requestId",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .get("/v1/open-verses/:listingId/submissions", (c) =>
    c.json([] as z.infer<typeof openVerseSubmissionSchema>[])
  )
  .post(
    "/v1/open-verses/:listingId/submissions/:submissionId/accept",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .post(
    "/v1/open-verses/:listingId/final-master",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .delete("/v1/open-verses/:listingId", (c) =>
    c.json({} as Record<string, unknown>)
  )
  .get("/v1/presence", genericQueryValidator, (c) =>
    c.json({} as Record<string, unknown>)
  )
  .post("/v1/presence/heartbeat", jsonValidator(genericJsonBodySchema), (c) =>
    c.json({} as Record<string, unknown>)
  )
  .post("/v1/presence/query", jsonValidator(genericJsonBodySchema), (c) =>
    c.json({} as Record<string, unknown>)
  )
  .delete("/v1/projects/:projectId", (c) =>
    c.json({} as Record<string, unknown>)
  )
  .patch(
    "/v1/projects/:projectId/tracks/order",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .post(
    "/v1/projects/:projectId/tracks",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>, 201)
  )
  .get("/v1/projects/:projectId/export", (c) =>
    c.json({} as Record<string, unknown>)
  )
  .post("/v1/projects/:projectId/export", (c) =>
    c.json({} as Record<string, unknown>, 202)
  )
  .get("/v1/social/profiles/:username", (c) =>
    c.json({} as Record<string, unknown>)
  )
  .get(
    "/v1/search/semantic",
    validator("query", (value) =>
      z.object({ limit: z.string().optional(), q: z.string() }).parse(value)
    ),
    (c) => c.json([] as z.infer<typeof semanticSearchResultSchema>[])
  )
  .post("/v1/payments/checkout", jsonValidator(genericJsonBodySchema), (c) =>
    c.json({} as Record<string, unknown>)
  )
  .post("/v1/payments/tips", jsonValidator(genericJsonBodySchema), (c) =>
    c.json({} as Record<string, unknown>)
  )
  .get("/v1/tracks/:trackId/playback", genericQueryValidator, (c) =>
    c.json({} as Record<string, unknown>)
  )
  .post("/v1/tracks/:trackId/recover", (c) =>
    c.json({} as z.infer<typeof messageResponseSchema>)
  )
  .get("/v1/uploads", (c) =>
    c.json({} as z.infer<typeof messageResponseSchema>)
  )
  .post(
    "/v1/videos/:videoId/playback-sessions",
    jsonValidator(createPlaybackSessionBodySchema),
    (c) => c.json({} as z.infer<typeof playbackSessionResponseSchema>, 201)
  )
  .post(
    "/v1/messages/conversations/:conversationId/collaborations",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>, 201)
  )
  .post(
    "/v1/messages/conversations/:conversationId/collaborations/:collaborationId/respond",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .post(
    "/v1/onboarding/eligibility",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .post("/v1/onboarding/exit", (c) => c.json({} as Record<string, unknown>))
  .post("/v1/projects/:projectId/pre-save", (c) =>
    c.json({} as z.infer<typeof messageResponseSchema>)
  )
  .post("/v1/videos/:videoId/pre-save", (c) =>
    c.json({} as z.infer<typeof messageResponseSchema>)
  )
  .get("/v1/live/rooms/queue", (c) => c.json({} as Record<string, unknown>))
  .get("/v1/live/rooms/:roomId", (c) => c.json({} as Record<string, unknown>))
  .post(
    "/v1/live/rooms/:roomId/battle/kit",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .post(
    "/v1/live/rooms/:roomId/battle/track",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .post(
    "/v1/live/rooms/:roomId/party/playback",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .post(
    "/v1/live/rooms/:roomId/chat",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .post(
    "/v1/live/rooms/:roomId/vote",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .post(
    "/v1/live/rooms/:roomId/queue",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .post(
    "/v1/live/rooms/:roomId/leave",
    jsonValidator(genericJsonBodySchema),
    (c) => c.json({} as Record<string, unknown>)
  )
  .post("/v1/seller/account-session", (c) =>
    c.json({} as z.infer<typeof sellerAccountSessionSchema>)
  )
  .get("/v1/seller/status", (c) =>
    c.json({} as z.infer<typeof sellerStatusSchema>)
  )
  .get("/v1/analytics/overview", (c) =>
    c.json({} as z.infer<typeof analyticsOverviewSchema>)
  )
  .post(
    "/v1/seller/account-link",
    jsonValidator(createSellerAccountLinkBodySchema),
    (c) => c.json({} as z.infer<typeof sellerOnboardingResponseSchema>)
  )
  .post("/v1/social/artists/:username/follow", (c) =>
    c.json({} as z.infer<typeof followResponseSchema>)
  )
  .delete("/v1/social/artists/:username/follow", (c) =>
    c.json({} as z.infer<typeof followResponseSchema>)
  )
  .post("/v1/social/profiles/:username/follow", (c) =>
    c.json({} as z.infer<typeof followResponseSchema>)
  )
  .delete("/v1/social/profiles/:username/follow", (c) =>
    c.json({} as z.infer<typeof followResponseSchema>)
  );

export type AppType = typeof rpcContract;
