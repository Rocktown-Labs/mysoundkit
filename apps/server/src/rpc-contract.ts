import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";

import type {
  adminAccessSchema,
  adminPaymentsOverviewSchema,
  adminOverviewSchema,
  artistSummarySchema,
  battleSummarySchema,
  conversationSummarySchema,
  directVideoUploadResponseSchema,
  entitlementSummarySchema,
  friendSummarySchema,
  libraryOverviewSchema,
  libraryRecentTrackSchema,
  librarySavedTrackSchema,
  libraryWatchedItemSchema,
  listeningPartySummarySchema,
  lyricsRevisionSchema,
  meResponseSchema,
  messageSchema,
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
  videoSummarySchema,
} from "./lib/schemas";
import {
  adminImportStripePlanBodySchema,
  adminSyncStripePlansBodySchema,
  createChallengeBodySchema,
  createConversationBodySchema,
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
  directVideoUploadBodySchema,
  onboardingArtistBodySchema,
  onboardingFanBodySchema,
  onboardingResponseSchema,
  openVerseQuerySchema,
  playbackProgressBodySchema,
  artistRankingQuerySchema,
  profileUpdateBodySchema,
  publicExploreQuerySchema,
  publicSearchQuerySchema,
  reviewLyricsRevisionBodySchema,
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

export const rpcContract = new Hono()
  .get("/v1/admin/access", (c) =>
    c.json({} as z.infer<typeof adminAccessSchema>)
  )
  .get("/v1/admin/overview", (c) =>
    c.json({} as z.infer<typeof adminOverviewSchema>)
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
  .post(
    "/v1/tracks/:trackId/assets",
    jsonValidator(createTrackAssetBodySchema),
    (c) => c.json({} as z.infer<typeof trackDashboardDetailSchema>)
  )
  .post("/v1/tracks/:trackId/process", (c) =>
    c.json({} as z.infer<typeof trackProcessingStatusSchema>)
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
    "/v1/live/cloudflare-stream",
    jsonValidator(z.object({ title: z.string().optional() })),
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
  .get("/v1/seller/status", (c) =>
    c.json({} as z.infer<typeof sellerStatusSchema>)
  )
  .post(
    "/v1/seller/account-link",
    jsonValidator(createSellerAccountLinkBodySchema),
    (c) => c.json({} as z.infer<typeof sellerOnboardingResponseSchema>)
  );

export type AppType = typeof rpcContract;
