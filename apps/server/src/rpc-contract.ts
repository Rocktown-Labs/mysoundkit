/* oxlint-disable one-var, sort-vars, unicorn/max-nested-calls */
import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";

import {
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
  adminGenreSchema,
  adminPaymentsOverviewSchema,
  adminOverviewSchema,
  adminSyncStripePlansResponseSchema,
  analyticsOverviewSchema,
  backfillTrackDurationsResponseSchema,
  trackDurationBackfillStatusSchema,
  artistProfileMediaSchema,
  artistSummarySchema,
  battleChallengesResponseSchema,
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
  checkoutBodySchema = z.object({
    cancelUrl: z.url(),
    planCode: z.string(),
    referenceId: z.string().optional(),
    seats: z.number().int().positive().optional(),
    successUrl: z.url(),
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
  .delete("/v1/social/profiles/:username/follow", (c) =>
    c.json({} as z.infer<typeof followResponseSchema>)
  );

export type AppType = typeof rpcContract;
