import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";

import type {
  adminAccessSchema,
  adminPaymentsOverviewSchema,
  adminOverviewSchema,
  backfillTrackDurationsResponseSchema,
  trackDurationBackfillStatusSchema,
  platformSettingsSchema,
  artistSummarySchema,
  battleChallengesResponseSchema,
  battleSummarySchema,
  conversationSummarySchema,
  directVideoUploadResponseSchema,
  discoverHomeResponseSchema,
  entitlementSummarySchema,
  friendSummarySchema,
  peopleSearchResultSchema,
  libraryOverviewSchema,
  libraryRecentTrackSchema,
  librarySavedTrackSchema,
  libraryWatchedItemSchema,
  listeningPartySummarySchema,
  lyricsRevisionSchema,
  meResponseSchema,
  messageSchema,
  notificationSettingsSchema,
  openVerseListingSchema,
  openVersePageSchema,
  openVerseSubmissionSchema,
  playbackProgressResponseSchema,
  playbackSessionResponseSchema,
  playlistSchema,
  planSchema,
  projectDashboardDetailSchema,
  publicSearchResultSchema,
  projectSummarySchema,
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
} from "./lib/schemas";
import {
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
  battleBotActionBodySchema,
  joinLiveExperienceBodySchema,
  liveSessionLockCheckBodySchema,
  onboardingArtistBodySchema,
  onboardingFanBodySchema,
  onboardingResponseSchema,
  openVerseQuerySchema,
  playbackProgressBodySchema,
  artistRankingQuerySchema,
  profileUpdateBodySchema,
  publicExploreQuerySchema,
  peopleSearchQuerySchema,
  publicSearchQuerySchema,
  reviewLyricsRevisionBodySchema,
  settleTrackBodySchema,
  updatePlatformSettingsBodySchema,
  updateBattleChallengeBodySchema,
  updateNotificationSettingsBodySchema,
  updateProjectBodySchema,
  updateTrackBodySchema,
  usernameAvailabilityQuerySchema,
} from "./lib/schemas";

const jsonValidator = <Schema extends z.ZodType>(schema: Schema) =>
  validator("json", (value) => schema.parse(value) as z.infer<Schema>);

const checkoutBodySchema = z.object({
  cancelUrl: z.url(),
  planCode: z.string(),
  referenceId: z.string().optional(),
  seats: z.number().int().positive().optional(),
  successUrl: z.url(),
});

const checkoutResponseSchema = onboardingResponseSchema.pick({
  checkoutUrl: true,
  requiresCheckout: true,
  setupRequired: true,
});

const cloudflareStreamBodySchema = z.object({
  title: z.string().optional(),
});

const genreCatalogItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

const notificationSummarySchema = z
  .object({
    body: z.string(),
    createdAt: z.string(),
    id: z.string(),
    readAt: z.string().nullable(),
    title: z.string(),
    type: z.string(),
  })
  .passthrough();

const notificationsResponseSchema = z.object({
  notifications: z.array(notificationSummarySchema),
  unreadCount: z.number().int().nonnegative(),
});

const followResponseSchema = z.object({
  followed: z.boolean(),
  followerCount: z.number().int().nonnegative(),
});

const liveExperienceSummarySchema = z
  .object({
    id: z.string(),
    kind: z.enum(["battle", "party", "stream"]),
    roomHref: z.string(),
    status: z.string(),
    title: z.string(),
  })
  .passthrough();

const liveExperienceResponseSchema = z
  .object({
    defaults: z.object({}).passthrough(),
    experience: liveExperienceSummarySchema,
    lock: z.object({}).passthrough(),
    notifications: z.array(z.object({}).passthrough()),
    realtime: z.object({}).passthrough(),
    streamInput: z.unknown().nullable(),
  })
  .passthrough();

const liveParticipantResponseSchema = z
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
  .passthrough();

const liveExperienceActionResponseSchema = z
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
  .get("/v1/admin/settings", (c) =>
    c.json({} as z.infer<typeof platformSettingsSchema>)
  )
  .patch(
    "/v1/admin/settings",
    jsonValidator(updatePlatformSettingsBodySchema),
    (c) => c.json({} as z.infer<typeof platformSettingsSchema>)
  )
  .get("/v1/admin/finance/payments", (c) =>
    c.json({} as z.infer<typeof adminPaymentsOverviewSchema>)
  )
  .post(
    "/v1/admin/finance/payments/sync-plans",
    jsonValidator(adminSyncStripePlansBodySchema),
    (c) => c.json({ message: "", results: [] })
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
  .post(
    "/v1/messages/conversations/:conversationId/messages",
    jsonValidator(createMessageBodySchema),
    (c) => c.json({} as z.infer<typeof messageSchema>, 201)
  )
  .get(
    "/v1/search",
    validator("query", (value) => publicSearchQuerySchema.parse(value)),
    (c) => c.json({} as z.infer<typeof publicSearchResultSchema>)
  )
  .get("/v1/discover/home", (c) =>
    c.json({} as z.infer<typeof discoverHomeResponseSchema>)
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
  .get("/v1/projects/public", (c) =>
    c.json([] as z.infer<typeof projectSummarySchema>[])
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
  .get("/v1/listening-parties/", (c) =>
    c.json([] as z.infer<typeof listeningPartySummarySchema>[])
  )
  .post(
    "/v1/listening-parties/",
    jsonValidator(createListeningPartyBodySchema),
    (c) => c.json({} as z.infer<typeof listeningPartySummarySchema>, 201)
  )
  .get("/v1/battles/", (c) =>
    c.json([] as z.infer<typeof battleSummarySchema>[])
  )
  .get("/v1/battles/challenges", (c) =>
    c.json({} as z.infer<typeof battleChallengesResponseSchema>)
  )
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
  .get("/v1/notifications/", (c) =>
    c.json({} as z.infer<typeof notificationsResponseSchema>)
  )
  .post("/v1/notifications/read-all", (c) =>
    c.json({} as z.infer<typeof messageResponseSchema>)
  )
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
  .post(
    "/v1/seller/account-link",
    jsonValidator(createSellerAccountLinkBodySchema),
    (c) => c.json({} as z.infer<typeof sellerOnboardingResponseSchema>)
  )
  .post("/v1/social/artists/:username/follow", (c) =>
    c.json({} as z.infer<typeof followResponseSchema>)
  );

export type AppType = typeof rpcContract;
