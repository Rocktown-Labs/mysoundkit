import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { useEffect } from "react";

import { API_V1_URL, SoundKitApiError, apiClient, rpcJson } from "./api";
import { liveRoomKey } from "./live-room";

const meGet = apiClient.v1.me.index.$get,
  meProfilePatch = apiClient.v1.me.profile.$patch,
  meNotificationSettingsGet = apiClient.v1.me["notification-settings"].$get,
  meNotificationSettingsPatch = apiClient.v1.me["notification-settings"].$patch,
  meEntitlementsGet = apiClient.v1.me.entitlements.$get,
  billingCheckoutPost = apiClient.v1.billing.checkout.$post,
  billingPortalPost = apiClient.v1.billing.portal.$post,
  billingPlansGet = apiClient.v1.billing.plans.$get,
  adminAccessGet = apiClient.v1.admin.access.$get,
  adminFinancePaymentsGet = apiClient.v1.admin.finance.payments.$get,
  adminFinanceSummaryGet = apiClient.v1.admin.finance.summary.$get,
  adminEmbeddingStatusGet = apiClient.v1.admin.embeddings.status.$get,
  adminEmbeddingBackfillPost = apiClient.v1.admin.embeddings.backfill.$post,
  adminDiagnosticTestsGet = apiClient.v1.admin["audio-diagnostics"].tests.$get,
  adminDiagnosticJobsGet = apiClient.v1.admin["audio-diagnostics"].jobs.$get,
  adminDiagnosticJobCreatePost =
    apiClient.v1.admin["audio-diagnostics"].jobs.$post,
  adminDiagnosticJobGet =
    apiClient.v1.admin["audio-diagnostics"].jobs[":jobId"].$get,
  adminImportStripePlanPost =
    apiClient.v1.admin.finance.payments["import-plan"].$post,
  adminOverviewGet = apiClient.v1.admin.overview.$get,
  adminBackfillTrackDurationsPost =
    apiClient.v1.admin.tracks["backfill-durations"].$post,
  adminBackfillTrackDurationsStatusGet =
    apiClient.v1.admin.tracks["backfill-durations"].status.$get,
  adminSyncStripePlansPost =
    apiClient.v1.admin.finance.payments["sync-plans"].$post,
  artistOnboardingPost = apiClient.v1.onboarding.artist.$post,
  artistsGet = apiClient.v1.artists.index.$get,
  artistGet = apiClient.v1.artists[":username"].$get,
  artistMediaGet = apiClient.v1.artists[":username"].media.$get,
  fanOnboardingPost = apiClient.v1.onboarding.fan.$post,
  genresGet = apiClient.v1.discover.genres.$get,
  searchGet = apiClient.v1.search.$get,
  semanticSearchGet = apiClient.v1.search.semantic.$get,
  tracksGet = apiClient.v1.tracks.index.$get,
  tracksPost = apiClient.v1.tracks.index.$post,
  trackGet = apiClient.v1.tracks[":trackId"].$get,
  trackPatch = apiClient.v1.tracks[":trackId"].$patch,
  trackDelete = apiClient.v1.tracks[":trackId"].$delete,
  trackRecoverPost = apiClient.v1.tracks[":trackId"].recover.$post,
  trackAssetPost = apiClient.v1.tracks[":trackId"].assets.$post,
  trackSettlePost = apiClient.v1.tracks[":trackId"].settle.$post,
  trackMediaProcessingGet = apiClient.v1.tracks[":trackId"].processing.$get,
  trackMediaProcessingRetryPost =
    apiClient.v1.tracks[":trackId"].processing.retry.$post,
  trackProcessPost = apiClient.v1.tracks[":trackId"].process.$post,
  trackLyricsPost = apiClient.v1.tracks[":trackId"].lyrics.$post,
  trackLyricsReviewPatch =
    apiClient.v1.tracks[":trackId"].lyrics[":lyricsId"].$patch,
  projectsGet = apiClient.v1.projects.index.$get,
  publicProjectsGet = apiClient.v1.projects.public.$get,
  publicProjectGet = apiClient.v1.projects.public[":projectId"].$get,
  projectsPost = apiClient.v1.projects.index.$post,
  projectGet = apiClient.v1.projects[":projectId"].$get,
  projectPatch = apiClient.v1.projects[":projectId"].$patch,
  projectLibraryAssetsPost =
    apiClient.v1.projects[":projectId"]["library-assets"].$post,
  listeningPartyPost = apiClient.v1["listening-parties"].index.$post,
  listeningPartiesGet = apiClient.v1["listening-parties"].index.$get,
  battlesGet = apiClient.v1.battles.index.$get,
  battleOpponentsGet = apiClient.v1.battles.opponents.$get,
  battleChallengesGet = apiClient.v1.battles.challenges.$get,
  battleKitsGet = apiClient.v1.battles.kits.$get,
  battleKitGet = apiClient.v1.battles.kits[":kitId"].$get,
  battleKitsPost = apiClient.v1.battles.kits.$post,
  battleKitPatch = apiClient.v1.battles.kits[":kitId"].$patch,
  battleKitDelete = apiClient.v1.battles.kits[":kitId"].$delete,
  battleChallengePost = apiClient.v1.battles.challenge.$post,
  battleChallengePatch = apiClient.v1.battles.challenges[":challengeId"].$patch,
  liveExperiencesGet = apiClient.v1.live.experiences.public.$get,
  liveMyExperiencesGet = apiClient.v1.live.experiences.me.$get,
  liveExperienceDelete = apiClient.v1.live.experiences[":experienceId"].$delete,
  liveExperiencePost = apiClient.v1.live.experiences.index.$post,
  liveExperienceReviewCatalogGet =
    apiClient.v1.live.experiences[":experienceId"]["review-catalog"].$get,
  liveExperienceOverlayTokenPost =
    apiClient.v1.live.experiences[":experienceId"]["overlay-token"].$post,
  liveExperienceJoinPost =
    apiClient.v1.live.experiences[":experienceId"].join.$post,
  liveRoomStreamBotPost = apiClient.v1.live.rooms[":roomId"].stream.bot.$post,
  liveRoomNowPlayingPost =
    apiClient.v1.live.rooms[":roomId"].stream["now-playing"].$post,
  liveExperienceBattleBotPost =
    apiClient.v1.live.experiences[":experienceId"].battlebot.$post,
  liveExperienceSessionLockCheckPost =
    apiClient.v1.live.experiences[":experienceId"]["session-locks"].check.$post,
  libraryOverviewGet = apiClient.v1.library.overview.$get,
  libraryPlaylistsGet = apiClient.v1.library.playlists.$get,
  libraryPurchasesGet = apiClient.v1.library.purchases.$get,
  libraryPurchaseGet = apiClient.v1.library.purchases[":purchaseId"].$get,
  libraryRecentGet = apiClient.v1.library.recent.$get,
  librarySavedGet = apiClient.v1.library.saved.$get,
  librarySaveTrackPost = apiClient.v1.library.saved[":trackId"].$post,
  librarySaveTrackDelete = apiClient.v1.library.saved[":trackId"].$delete,
  libraryPlaylistsPost = apiClient.v1.library.playlists.$post,
  libraryPlaylistDelete = apiClient.v1.library.playlists[":id"].$delete,
  libraryPlaylistGet = apiClient.v1.library.playlists[":id"].$get,
  libraryPlaylistTracksPost =
    apiClient.v1.library.playlists[":id"].tracks.$post,
  libraryPlaylistTrackDelete =
    apiClient.v1.library.playlists[":id"].tracks[":trackId"].$delete,
  libraryWatchedGet = apiClient.v1.library.watched.$get,
  friendsGet = apiClient.v1.messages.friends.$get,
  friendRequestsGet = apiClient.v1.messages["friend-requests"].$get,
  networkGet = apiClient.v1.network.index.$get,
  workspaceGet = apiClient.v1.me.workspace.$get,
  workspaceInvitePost = apiClient.v1.me.workspace.invitations.$post,
  workspaceInvitationDelete =
    apiClient.v1.me.workspace.invitations[":invitationId"].$delete,
  workspaceMemberDelete =
    apiClient.v1.me.workspace.members[":memberId"].$delete,
  friendRequestsPost = apiClient.v1.messages["friend-requests"].$post,
  friendRequestPatch =
    apiClient.v1.messages["friend-requests"][":requestId"].$patch,
  peopleSearchGet = apiClient.v1.messages.people.$get,
  conversationsGet = apiClient.v1.messages.conversations.$get,
  conversationsPost = apiClient.v1.messages.conversations.$post,
  conversationMessagesGet =
    apiClient.v1.messages.conversations[":conversationId"].messages.$get,
  conversationMessagesPost =
    apiClient.v1.messages.conversations[":conversationId"].messages.$post,
  openVersesGet = apiClient.v1["open-verses"].index.$get,
  openVersesPost = apiClient.v1["open-verses"].index.$post,
  openVerseGet = apiClient.v1["open-verses"][":listingId"].$get,
  openVerseSubmissionPost =
    apiClient.v1["open-verses"][":listingId"].submissions.$post,
  videosGet = apiClient.v1.videos.index.$get,
  videosPost = apiClient.v1.videos.index.$post,
  videoGet = apiClient.v1.videos[":videoId"].$get,
  videoAnalyticsGet = apiClient.v1.videos[":videoId"].analytics.$get,
  videoViewSessionPost = apiClient.v1.videos[":videoId"]["view-sessions"].$post,
  videoViewSessionProgressPost =
    apiClient.v1.videos[":videoId"]["view-sessions"][":sessionId"].progress
      .$post,
  videoViewSessionEndPost =
    apiClient.v1.videos[":videoId"]["view-sessions"][":sessionId"].end.$post,
  videoCommentsGet = apiClient.v1.videos[":videoId"].comments.$get,
  videoCommentsPost = apiClient.v1.videos[":videoId"].comments.$post,
  videoDelete = apiClient.v1.videos[":videoId"].$delete,
  notificationsGet = apiClient.v1.notifications.index.$get,
  notificationReadPost =
    apiClient.v1.notifications[":notificationId"].read.$post,
  notificationsReadAllPost = apiClient.v1.notifications["read-all"].$post,
  notificationsClearPost = apiClient.v1.notifications.clear.$post,
  trackPreSavePost = apiClient.v1.tracks[":trackId"]["pre-save"].$post,
  artistFollowPost = apiClient.v1.social.artists[":username"].follow.$post,
  artistFollowDelete = apiClient.v1.social.artists[":username"].follow.$delete,
  profileFollowPost = apiClient.v1.social.profiles[":username"].follow.$post,
  sellerAccountLinkPost = apiClient.v1.seller["account-link"].$post,
  sellerAccountSessionPost = apiClient.v1.seller["account-session"].$post,
  sellerStatusGet = apiClient.v1.seller.status.$get,
  artistSetupGuideGet = apiClient.v1["artist-setup-guide"].index.$get,
  platformInvitePost = apiClient.v1.referrals.invite.$post,
  battleRecordGet = apiClient.v1.battles.record.$get,
  battleStatsGet = apiClient.v1.battles.stats.$get,
  trackBattleHistoryGet =
    apiClient.v1.battles["track-history"][":trackId"].$get,
  analyticsOverviewGet = apiClient.v1.analytics.overview.$get,
  analyticsTimeseriesGet = apiClient.v1.analytics.timeseries.$get,
  analyticsTracksGet = apiClient.v1.analytics.tracks.$get,
  analyticsAudienceGet = apiClient.v1.analytics.audience.$get,
  analyticsSourcesGet = apiClient.v1.analytics.sources.$get,
  analyticsLocationsGet = apiClient.v1.analytics.locations.$get,
  analyticsLiveImpactGet = apiClient.v1.analytics["live-impact"].$get,
  analyticsEarningsGet = apiClient.v1.analytics.earnings.$get;

type ArtistOnboardingBody = InferRequestType<
  typeof artistOnboardingPost
>["json"];
type FanOnboardingBody = InferRequestType<typeof fanOnboardingPost>["json"];
type SearchQuery = InferRequestType<typeof searchGet>["query"];
type ArtistRankingQuery = InferRequestType<typeof artistsGet>["query"];
type PublicExploreQuery = InferRequestType<typeof tracksGet>["query"];
export type TrackSummary = InferResponseType<typeof tracksGet, 200>[number];
export type TrackDetail = InferResponseType<typeof trackGet, 200>;
type CreateTrackBody = InferRequestType<typeof tracksPost>["json"];
export type UpdateTrackBody = InferRequestType<typeof trackPatch>["json"];
type CreateTrackAssetBody = InferRequestType<typeof trackAssetPost>["json"];
type SettleTrackBody = InferRequestType<typeof trackSettlePost>["json"];
export type MediaProcessingStatus = InferResponseType<
  typeof trackMediaProcessingGet,
  200
>;
type TrackProcessingStatus = InferResponseType<typeof trackProcessPost, 200>;
type CreateLyricsRevisionBody = InferRequestType<
  typeof trackLyricsPost
>["json"];
type ReviewLyricsRevisionBody = InferRequestType<
  typeof trackLyricsReviewPatch
>["json"];
type CreateProjectBody = InferRequestType<typeof projectsPost>["json"];
type UpdateProjectBody = InferRequestType<typeof projectPatch>["json"];
type AttachProjectLibraryAssetsBody = InferRequestType<
  typeof projectLibraryAssetsPost
>["json"];
export type ProjectSummary = InferResponseType<typeof projectsGet, 200>[number];
export type PublicProjectSummary = InferResponseType<
  typeof publicProjectsGet,
  200
>[number];
export type PublicProjectsQuery = NonNullable<
  InferRequestType<typeof publicProjectsGet>["query"]
>;
export type PublicProjectDetail = InferResponseType<
  typeof publicProjectGet,
  200
>;
type CreateListeningPartyBody = InferRequestType<
  typeof listeningPartyPost
>["json"];
type OpenVerseQuery = InferRequestType<typeof openVersesGet>["query"];
export type OpenVerseListing = InferResponseType<typeof openVerseGet, 200>;
type CreateOpenVerseBody = InferRequestType<typeof openVersesPost>["json"];
type CreateOpenVerseSubmissionBody = InferRequestType<
  typeof openVerseSubmissionPost
>["json"];
type CreateVideoBody = InferRequestType<typeof videosPost>["json"];
export type VideoSummary = InferResponseType<typeof videosGet, 200>[number];
export type VideoDetail = InferResponseType<typeof videoGet, 200>;
export type VideoAnalytics = InferResponseType<typeof videoAnalyticsGet, 200>;
type VideoViewSessionStartBody = InferRequestType<
  typeof videoViewSessionPost
>["json"];
type VideoViewSessionProgressBody = InferRequestType<
  typeof videoViewSessionProgressPost
>["json"];
export type VideoComment = InferResponseType<
  typeof videoCommentsGet,
  200
>[number];
export type NotificationPage = InferResponseType<typeof notificationsGet, 200>;
export type ArtistSummary = InferResponseType<typeof artistsGet, 200>[number];
export type GenreSummary = InferResponseType<typeof genresGet, 200>[number];
export type ArtistProfileMedia = InferResponseType<typeof artistMediaGet, 200>;
export type ArtistProfileCredit = ArtistProfileMedia["credits"][number];
type ArtistFollowResponse = InferResponseType<typeof artistFollowPost, 200>;
type SellerAccountLinkBody = InferRequestType<
  typeof sellerAccountLinkPost
>["json"];
type SellerAccountLinkResponse = InferResponseType<
  typeof sellerAccountLinkPost,
  200
>;
export type SellerAccountSession = InferResponseType<
  typeof sellerAccountSessionPost,
  200
>;
type SellerStatus = InferResponseType<typeof sellerStatusGet, 200>;
export type ArtistSetupGuide = InferResponseType<
  typeof artistSetupGuideGet,
  200
>;
export type PlatformInviteResponse = InferResponseType<
  typeof platformInvitePost,
  200
>;
export type MeSummary = InferResponseType<typeof meGet, 200>;
type EntitlementSummary = InferResponseType<typeof meEntitlementsGet, 200>;
type BillingCheckoutBody = InferRequestType<typeof billingCheckoutPost>["json"];
export type BillingCheckoutResponse = InferResponseType<
  typeof billingCheckoutPost,
  200
>;
type BillingPortalBody = InferRequestType<typeof billingPortalPost>["json"];
type BillingPortalResponse = InferResponseType<typeof billingPortalPost, 200>;
export type BillingPlan = InferResponseType<
  typeof billingPlansGet,
  200
>[number];
type UpdateMeProfileBody = InferRequestType<typeof meProfilePatch>["json"];
type UpdateNotificationSettingsBody = InferRequestType<
  typeof meNotificationSettingsPatch
>["json"];
type NotificationSettings = InferResponseType<
  typeof meNotificationSettingsGet,
  200
>;
export type BattleSummary = InferResponseType<typeof battlesGet, 200>[number];
export type BattleParticipant = BattleSummary["participants"][number];
export type BattleChallengesResponse = InferResponseType<
  typeof battleChallengesGet,
  200
>;
export type BattleKit = InferResponseType<typeof battleKitsGet, 200>[number];
type BattleKitQuery = InferRequestType<typeof battleKitsGet>["query"];
export type BattleKitTrackInput = InferRequestType<
  typeof battleKitsPost
>["json"]["tracks"][number];
export type LibraryOverview = InferResponseType<typeof libraryOverviewGet, 200>;
export type LibraryPlaylist = InferResponseType<
  typeof libraryPlaylistsGet,
  200
>[number];
export type LibraryPurchase = InferResponseType<
  typeof libraryPurchasesGet,
  200
>[number];
export type LibraryPurchaseDetail = InferResponseType<
  typeof libraryPurchaseGet,
  200
>;
export type LibraryRecentTrack = InferResponseType<
  typeof libraryRecentGet,
  200
>[number];
export type LibrarySavedTrack = InferResponseType<
  typeof librarySavedGet,
  200
>[number];
export type LibraryWatchedItem = InferResponseType<
  typeof libraryWatchedGet,
  200
>[number];
export type CreateBattleChallengeBody = InferRequestType<
  typeof battleChallengePost
>["json"];
export type UpdateBattleChallengeBody = InferRequestType<
  typeof battleChallengePatch
>["json"];
type CreateLiveExperienceBody = InferRequestType<
  typeof liveExperiencePost
>["json"];
type JoinLiveExperienceBody = InferRequestType<
  typeof liveExperienceJoinPost
>["json"];
type BattleBotActionBody = InferRequestType<
  typeof liveExperienceBattleBotPost
>["json"];
type StreamBotBody = InferRequestType<typeof liveRoomStreamBotPost>["json"];
type StreamNowPlayingBody = InferRequestType<
  typeof liveRoomNowPlayingPost
>["json"];
type LiveSessionLockCheckBody = InferRequestType<
  typeof liveExperienceSessionLockCheckPost
>["json"];
export type LiveExperienceCreateResponse = InferResponseType<
  typeof liveExperiencePost,
  201
>;
export type LiveExperienceJoinResponse = InferResponseType<
  typeof liveExperienceJoinPost,
  201
>;
export type LiveReviewCatalogTrack = InferResponseType<
  typeof liveExperienceReviewCatalogGet,
  200
>[number];
export type LiveOverlayTokenResponse = InferResponseType<
  typeof liveExperienceOverlayTokenPost,
  201
>;
export type ListeningPartySummary = InferResponseType<
  typeof listeningPartiesGet,
  200
>[number];
export type FriendSummary = InferResponseType<typeof friendsGet, 200>[number];
export type NetworkResponse = InferResponseType<typeof networkGet, 200>;
export type WorkspaceDetail = InferResponseType<typeof workspaceGet, 200>;
export type FriendRequestSummary = InferResponseType<
  typeof friendRequestsGet,
  200
>[number];
export type ConversationSummary = InferResponseType<
  typeof conversationsGet,
  200
>[number];
export type MessageSummary = InferResponseType<
  typeof conversationMessagesGet,
  200
>[number];
type CreateConversationBody = InferRequestType<
  typeof conversationsPost
>["json"];
type CreateMessageBody = InferRequestType<
  typeof conversationMessagesPost
>["json"];
type ImportStripePlanBody = InferRequestType<
  typeof adminImportStripePlanPost
>["json"];
type SyncStripePlansBody = InferRequestType<
  typeof adminSyncStripePlansPost
>["json"];
type BackfillTrackDurationsBody = InferRequestType<
  typeof adminBackfillTrackDurationsPost
>["json"];

export type AdTargetType = "country" | "state";
export type AdCreativeFormat = "audio" | "image" | "video";
export type AdPlacement =
  | "audio_preroll"
  | "video_overlay"
  | "video_preroll"
  | "sponsored_queue"
  | "featured_rail"
  | "battle_boost";
export type AdBillingType = "house" | "prepaid_wallet" | "upfront_recurring";
export type AdEntityType = "battle" | "project" | "stream" | "track" | "video";
export type AdCampaignStatus =
  | "active"
  | "draft"
  | "exhausted_for_today"
  | "expired"
  | "paused"
  | "pending_review"
  | "rejected";

export interface AdTarget {
  targetCode: string;
  targetType: AdTargetType;
}

export interface AdCampaignSummary {
  allowConquest: boolean;
  billingType: AdBillingType;
  clickthroughUrl: string;
  creativeFormat: AdCreativeFormat;
  creativeImageUrl: string | null;
  creativeUrl: string;
  dailyBudgetCents: number;
  dailyImpressionCap: number;
  endDate: string | null;
  entityId: string | null;
  entityType: AdEntityType | null;
  id: string;
  metrics: {
    clicks: number;
    cpcCents: number | null;
    cpmCents: number | null;
    ctrPercent: number;
    impressions: number;
    spendCents: number;
  };
  name: string;
  placement: AdPlacement;
  startDate: string;
  status: AdCampaignStatus;
  targets: AdTarget[];
}

export interface AdWalletSummary {
  balanceCents: number;
  currency: string;
}

export interface CreateAdCampaignBody {
  allowConquest: boolean;
  billingType: AdBillingType;
  clickthroughUrl: string;
  creativeFormat: AdCreativeFormat;
  creativeImageUrl?: string;
  creativeUrl: string;
  dailyBudgetCents: number;
  dailyImpressionCap: number;
  endDate?: string;
  entityId?: string;
  entityType?: AdEntityType;
  name: string;
  placement: AdPlacement;
  startDate?: string;
  targets: AdTarget[];
}

export const soundkitQueryKeys = {
  adAdminCampaigns: ["ads", "admin", "campaigns"] as const,
  adCampaigns: ["ads", "campaigns"] as const,
  adWallet: ["ads", "wallet"] as const,
  adminAccess: ["admin", "access"] as const,
  adminOverview: ["admin", "overview"] as const,
  adminPayments: ["admin", "payments"] as const,
  analyticsOverview: ["analytics", "overview"] as const,
  artist: (username: string) => ["artists", username] as const,
  artistMedia: (username: string) => ["artists", username, "media"] as const,
  artistSetupGuide: ["artist-setup-guide"] as const,
  artists: (query?: ArtistRankingQuery) => ["artists", query ?? {}] as const,
  battleChallenges: ["battles", "challenges"] as const,
  battleKit: (id: string) => ["battles", "kits", id] as const,
  battleKits: ["battles", "kits"] as const,
  battleRecord: ["battles", "record"] as const,
  battles: ["battles"] as const,
  battlesStats: ["battles", "stats"] as const,
  billingPlans: ["billing", "plans"] as const,
  conversationMessages: (conversationId: string) =>
    ["messages", "conversations", conversationId, "messages"] as const,
  conversations: ["messages", "conversations"] as const,
  friendRequests: ["messages", "friend-requests"] as const,
  friends: ["messages", "friends"] as const,
  genres: ["discover", "genres"] as const,
  libraryOverview: ["library", "overview"] as const,
  libraryPlaylist: (id: string) => ["library", "playlists", id] as const,
  libraryPlaylists: ["library", "playlists"] as const,
  libraryPurchase: (purchaseId: string) =>
    ["library", "purchases", purchaseId] as const,
  libraryPurchases: ["library", "purchases"] as const,
  libraryRecent: ["library", "recent"] as const,
  librarySaved: ["library", "saved"] as const,
  libraryWatched: ["library", "watched"] as const,
  listeningParties: ["listening-parties"] as const,
  liveExperience: (id: string) => ["live", "experiences", id] as const,
  liveReviewCatalog: (id: string, query?: string) =>
    ["live", "experiences", id, "review-catalog", query ?? ""] as const,
  liveRoom: (id: string) => ["live", "rooms", id] as const,
  me: ["me"] as const,
  meEntitlements: ["me", "entitlements"] as const,
  meNotificationSettings: ["me", "notification-settings"] as const,
  network: ["network"] as const,
  notifications: ["notifications"] as const,
  openVerse: (id: string) => ["open-verses", id] as const,
  openVerses: (query?: OpenVerseQuery) => ["open-verses", query ?? {}] as const,
  peopleSearch: (q: string) => ["messages", "people", q] as const,
  project: (id: string) => ["projects", id] as const,
  projects: ["projects"] as const,
  publicProject: (id: string) => ["projects", "public", id] as const,
  publicProjects: (query?: PublicProjectsQuery) =>
    ["projects", "public", query ?? {}] as const,
  search: (query: SearchQuery) => ["search", query] as const,
  sellerStatus: ["seller", "status"] as const,
  track: (id: string) => ["tracks", id] as const,
  trackBattleHistory: (trackId: string) =>
    ["battles", "track-history", trackId] as const,
  trackMediaProcessing: (id: string) =>
    ["tracks", id, "media-processing"] as const,
  tracks: (query?: PublicExploreQuery) =>
    [...soundkitQueryKeys.tracksPrefix, query ?? {}] as const,
  tracksPrefix: ["tracks"] as const,
  videos: (query?: PublicExploreQuery) =>
    [...soundkitQueryKeys.videosPrefix, query ?? {}] as const,
  videosPrefix: ["videos"] as const,
  workspace: ["me", "workspace"] as const,
};

export const followProfileByUsername = async (username: string) =>
  rpcJson(
    await profileFollowPost({
      param: { username },
    })
  );

const fetchApiJson = async <T>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  const response = await fetch(`${API_V1_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new SoundKitApiError(
      payload?.message ?? `Request failed with ${response.status}.`,
      response.status
    );
  }

  return (await response.json()) as T;
};

export type LiveTipKind = "battle" | "party" | "stream";

export interface TipCheckoutBody {
  amountCents: number;
  cancelUrl: string;
  idempotencyKey?: string;
  liveExperienceId?: string;
  liveKind?: LiveTipKind;
  message?: string;
  recipientUserIds: string[];
  successUrl: string;
}

export interface TipCheckoutResponse {
  checkoutUrl: string | null;
  clientSecret: string | null;
  setupRequired: boolean;
  transactionId: string | null;
}

export const useTipCheckoutMutation = () =>
  useMutation({
    mutationFn: (body: TipCheckoutBody) =>
      fetchApiJson<TipCheckoutResponse>("/payments/tips", {
        body: JSON.stringify(body),
        method: "POST",
      }),
  });

export const useAdWalletQuery = () =>
  useQuery({
    queryFn: async () => fetchApiJson<AdWalletSummary>("/ads/wallet"),
    queryKey: soundkitQueryKeys.adWallet,
  });

export const useAdCampaignsQuery = () =>
  useQuery({
    queryFn: async () => fetchApiJson<AdCampaignSummary[]>("/ads/campaigns"),
    queryKey: soundkitQueryKeys.adCampaigns,
  });

export const useAdminAdCampaignsQuery = (enabled = true) =>
  useQuery({
    enabled,
    queryFn: async () =>
      fetchApiJson<AdCampaignSummary[]>("/ads/admin/campaigns"),
    queryKey: soundkitQueryKeys.adAdminCampaigns,
  });

export const useCreateAdCampaignMutation = () => {
  const queryClient = useQueryClient(),
   invalidateCampaigns = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.adCampaigns,
      }),
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.adAdminCampaigns,
      }),
    ]);

  return useMutation({
    mutationFn: async (body: CreateAdCampaignBody) =>
      fetchApiJson<AdCampaignSummary>("/ads/campaigns", {
        body: JSON.stringify(body),
        method: "POST",
      }),
    onSuccess: invalidateCampaigns,
  });
};

export const useSubmitAdCampaignMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) =>
      fetchApiJson<AdCampaignSummary>(`/ads/campaigns/${campaignId}/submit`, {
        method: "POST",
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.adCampaigns,
        }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.adAdminCampaigns,
        }),
      ]),
  });
};

export const useAdminAccessQuery = (enabled = true) =>
  useQuery({
    enabled,
    queryFn: async () => rpcJson(await adminAccessGet()),
    queryKey: soundkitQueryKeys.adminAccess,
  });

export const useAdminOverviewQuery = (enabled = true) =>
  useQuery({
    enabled,
    queryFn: async () => rpcJson(await adminOverviewGet()),
    queryKey: soundkitQueryKeys.adminOverview,
  });

export const useAdminPaymentsQuery = (enabled = true) =>
  useQuery({
    enabled,
    queryFn: async () => rpcJson(await adminFinancePaymentsGet()),
    queryKey: soundkitQueryKeys.adminPayments,
  });

export const useAdminFinanceSummaryQuery = (enabled = true) =>
  useQuery({
    enabled,
    queryFn: async () => rpcJson(await adminFinanceSummaryGet()),
    queryKey: ["admin", "finance", "summary"],
  });

export const useAdminEmbeddingStatusQuery = (enabled = true) =>
  useQuery({
    enabled,
    queryFn: async () => rpcJson(await adminEmbeddingStatusGet()),
    queryKey: ["admin", "embeddings", "status"],
  });

export const useAdminEmbeddingBackfillMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (limit: number) =>
      rpcJson(
        await adminEmbeddingBackfillPost({ query: { limit: `${limit}` } })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["admin", "embeddings", "status"],
      }),
  });
};

export type DiagnosticJob = InferResponseType<
  typeof adminDiagnosticJobCreatePost
>;

export const useDiagnosticTestsQuery = (enabled = true) =>
  useQuery({
    enabled,
    queryFn: async () => rpcJson(await adminDiagnosticTestsGet()),
    queryKey: ["admin", "audio-diagnostics", "tests"],
  });

export const useDiagnosticJobsQuery = (enabled = true) =>
  useQuery({
    enabled,
    queryFn: async () => rpcJson(await adminDiagnosticJobsGet()),
    queryKey: ["admin", "audio-diagnostics", "jobs"],
  });

export const useDiagnosticJobQuery = (jobId: string | null, enabled = true) =>
  useQuery({
    enabled: enabled && Boolean(jobId),
    queryFn: async () =>
      rpcJson(await adminDiagnosticJobGet({ param: { jobId: jobId ?? "" } })),
    queryKey: ["admin", "audio-diagnostics", "jobs", jobId],
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 5000 : false;
    },
  });

export const useCreateDiagnosticJobMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { tests: string[]; trackIds: string[] }) =>
      rpcJson(await adminDiagnosticJobCreatePost({ json: body })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["admin", "audio-diagnostics", "jobs"],
      }),
  });
};

export const useImportStripePlanMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: ImportStripePlanBody) =>
      rpcJson(await adminImportStripePlanPost({ json: body })),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.adminPayments,
        }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.adminOverview,
        }),
      ]),
  });
};

export const useSyncStripePlansMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: SyncStripePlansBody = {}) =>
      rpcJson(await adminSyncStripePlansPost({ json: body })),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.adminPayments,
        }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.adminOverview,
        }),
      ]),
  });
};

export const useBackfillTrackDurationsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: BackfillTrackDurationsBody) =>
      rpcJson(await adminBackfillTrackDurationsPost({ json: body })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.adminOverview,
      }),
  });
};

export const useTrackDurationBackfillStatusQuery = (
  runId: string | null,
  enabled = true
) =>
  useQuery({
    enabled,
    queryFn: async () =>
      rpcJson(
        await adminBackfillTrackDurationsStatusGet({
          query: runId ? { runId } : {},
        })
      ),
    queryKey: [
      "admin",
      "tracks",
      "backfill-durations",
      "status",
      runId ?? "latest",
    ],
    refetchInterval: (query) => {
      const status = query.state.data;

      if (!status) {
        return false;
      }

      const inFlight = status.queued + status.processing;

      return inFlight > 0 ? 3000 : false;
    },
  });

export const useMeQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await meGet()),
    queryKey: soundkitQueryKeys.me,
  });

export const useUpdateMeProfileMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateMeProfileBody) =>
      rpcJson(await meProfilePatch({ json: body })),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.me }),
        queryClient.invalidateQueries({ queryKey: ["artists"] }),
        queryClient.invalidateQueries({ queryKey: ["public-profile"] }),
        queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.network }),
      ]);
    },
  });
};

export const useNotificationSettingsQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await meNotificationSettingsGet()),
    queryKey: soundkitQueryKeys.meNotificationSettings,
  });

export const useUpdateNotificationSettingsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateNotificationSettingsBody) =>
      rpcJson(await meNotificationSettingsPatch({ json: body })),
    onError: (_error, _body, context) => {
      const rollback = context as OptimisticRollback | undefined;
      queryClient.setQueryData(
        soundkitQueryKeys.meNotificationSettings,
        rollback?.previousNotificationSettings
      );
    },
    onMutate: async (body) => {
      await queryClient.cancelQueries({
        queryKey: soundkitQueryKeys.meNotificationSettings,
      });
      const previousNotificationSettings =
        queryClient.getQueryData<NotificationSettings>(
          soundkitQueryKeys.meNotificationSettings
        );
      queryClient.setQueryData<NotificationSettings | undefined>(
        soundkitQueryKeys.meNotificationSettings,
        (settings) => (settings ? { ...settings, ...body } : settings)
      );
      return { previousNotificationSettings };
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(
        soundkitQueryKeys.meNotificationSettings,
        settings
      );
    },
  });
};

export const useMeEntitlementsQuery = () =>
  useQuery({
    queryFn: async (): Promise<EntitlementSummary> =>
      rpcJson(await meEntitlementsGet()),
    queryKey: soundkitQueryKeys.meEntitlements,
  });

export const useBillingPlansQuery = () =>
  useQuery<BillingPlan[]>({
    queryFn: async () => rpcJson(await billingPlansGet()),
    queryKey: soundkitQueryKeys.billingPlans,
    staleTime: 5 * 60_000,
  });

export const useBillingCheckoutMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      body: BillingCheckoutBody
    ): Promise<BillingCheckoutResponse> =>
      rpcJson(await billingCheckoutPost({ json: body })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.meEntitlements,
      }),
  });
};

export const useBillingPortalMutation = () =>
  useMutation({
    mutationFn: async (
      body: BillingPortalBody
    ): Promise<BillingPortalResponse> =>
      rpcJson(await billingPortalPost({ json: body })),
  });

export const useFriendsQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await friendsGet()),
    queryKey: soundkitQueryKeys.friends,
  });

export const useNetworkQuery = () =>
  useQuery<NetworkResponse>({
    queryFn: async () => rpcJson(await networkGet()),
    queryKey: soundkitQueryKeys.network,
  });

export const useWorkspaceQuery = () =>
  useQuery<WorkspaceDetail>({
    queryFn: async () => rpcJson(await workspaceGet()),
    queryKey: soundkitQueryKeys.workspace,
  });

export const useFriendRequestsQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await friendRequestsGet()),
    queryKey: soundkitQueryKeys.friendRequests,
  });

interface OptimisticRollback {
  previousConversations?: ConversationSummary[];
  previousNetwork?: NetworkResponse;
  previousNotificationSettings?: NotificationSettings;
  previousProject?: PublicProjectSummary;
  previousProjects?: ProjectSummary[];
  previousRequests?: FriendRequestSummary[];
  previousTrack?: TrackDetail;
  previousTracks?: [readonly unknown[], TrackSummary[]][];
  previousVideos?: [readonly unknown[], VideoSummary[]][];
}

export const useCreateFriendRequestMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: { message?: string; username: string }) =>
      rpcJson(await friendRequestsPost({ json: body })),
    onError: (_error, _variables, context) => {
      const rollback = context as OptimisticRollback | undefined;
      queryClient.setQueryData(
        soundkitQueryKeys.friendRequests,
        rollback?.previousRequests
      );
      queryClient.setQueryData(
        soundkitQueryKeys.network,
        rollback?.previousNetwork
      );
    },
    onMutate: async ({ message, username }) => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: soundkitQueryKeys.friendRequests,
        }),
        queryClient.cancelQueries({ queryKey: soundkitQueryKeys.network }),
      ]);
      const previousRequests = queryClient.getQueryData<FriendRequestSummary[]>(
          soundkitQueryKeys.friendRequests
        ),
        previousNetwork = queryClient.getQueryData<NetworkResponse>(
          soundkitQueryKeys.network
        ),
        optimisticRequest: FriendRequestSummary = {
          avatarUrl: null,
          createdAt: new Date().toISOString(),
          direction: "outgoing",
          displayName: `@${username}`,
          id: `local-${crypto.randomUUID()}`,
          message: message ?? null,
          status: "pending",
          userId: `local-${username}`,
          username,
        };
      queryClient.setQueryData<FriendRequestSummary[]>(
        soundkitQueryKeys.friendRequests,
        (requests = []) => [optimisticRequest, ...requests]
      );
      queryClient.setQueryData<NetworkResponse | undefined>(
        soundkitQueryKeys.network,
        (network) =>
          network
            ? {
                ...network,
                counts: {
                  ...network.counts,
                  pendingRequests: network.counts.pendingRequests + 1,
                },
                requests: [optimisticRequest, ...network.requests],
              }
            : network
      );
      return { previousNetwork, previousRequests };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.friendRequests,
        }),
        queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.friends }),
        queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.network }),
      ]);
    },
  });
};

export const useRespondFriendRequestMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      requestId,
    }: {
      action: "accept" | "cancel" | "decline";
      requestId: string;
    }) =>
      rpcJson(
        await friendRequestPatch({
          json: { action },
          param: { requestId },
        })
      ),
    onError: (_error, _variables, context) => {
      const rollback = context as OptimisticRollback | undefined;
      queryClient.setQueryData(
        soundkitQueryKeys.friendRequests,
        rollback?.previousRequests
      );
      queryClient.setQueryData(
        soundkitQueryKeys.network,
        rollback?.previousNetwork
      );
    },
    onMutate: async ({ action, requestId }) => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: soundkitQueryKeys.friendRequests,
        }),
        queryClient.cancelQueries({ queryKey: soundkitQueryKeys.network }),
      ]);
      const previousRequests = queryClient.getQueryData<FriendRequestSummary[]>(
          soundkitQueryKeys.friendRequests
        ),
        previousNetwork = queryClient.getQueryData<NetworkResponse>(
          soundkitQueryKeys.network
        ),
        request = previousRequests?.find((item) => item.id === requestId),
        removeRequest = (requests: FriendRequestSummary[] = []) =>
          requests.filter((item) => item.id !== requestId);
      queryClient.setQueryData<FriendRequestSummary[]>(
        soundkitQueryKeys.friendRequests,
        (requests = []) =>
          action === "accept"
            ? removeRequest(requests)
            : requests.map((item) =>
                item.id === requestId
                  ? {
                      ...item,
                      status: action === "cancel" ? "canceled" : "declined",
                    }
                  : item
              )
      );
      queryClient.setQueryData<NetworkResponse | undefined>(
        soundkitQueryKeys.network,
        (network) => {
          if (!network) {
            return network;
          }
          const pendingRequests = Math.max(
            0,
            network.counts.pendingRequests -
              (request?.status === "pending" ? 1 : 0)
          );
          if (action !== "accept" || !request) {
            return {
              ...network,
              counts: { ...network.counts, pendingRequests },
              requests:
                action === "accept"
                  ? network.requests
                  : removeRequest(network.requests),
            };
          }
          const friend = {
            accountType: "artist" as const,
            avatarUrl: request.avatarUrl,
            canMessage: true,
            email: null,
            followsYou: false,
            id: request.userId,
            isFollowing: false,
            isFriend: true,
            name: request.displayName,
            username: request.username,
          };
          return {
            ...network,
            counts: {
              ...network.counts,
              friends: network.counts.friends + 1,
              pendingRequests,
            },
            friends: [friend, ...network.friends],
            requests: removeRequest(network.requests),
          };
        }
      );
      return { previousNetwork, previousRequests };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.friendRequests,
        }),
        queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.friends }),
        queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.network }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.conversations,
        }),
      ]);
    },
  });
};

export const useGenresQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await genresGet()),
    queryKey: soundkitQueryKeys.genres,
  });

export const usePeopleSearchQuery = (q: string) =>
  useQuery({
    enabled: q.trim().length >= 2,
    queryFn: async () =>
      rpcJson(
        await peopleSearchGet({
          query: { limit: "8", q: q.trim() },
        })
      ),
    queryKey: soundkitQueryKeys.peopleSearch(q.trim()),
  });

export const useCreateConversationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateConversationBody) =>
      rpcJson(await conversationsPost({ json: body })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.conversations,
      }),
  });
};

export const useCreateMessageMutation = (conversationId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateMessageBody) =>
      rpcJson(
        await conversationMessagesPost({
          json: body,
          param: { conversationId },
        })
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.conversationMessages(conversationId),
        }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.conversations,
        }),
      ]),
  });
};

export const useArtistQuery = (username: string) =>
  useQuery({
    enabled: Boolean(username),
    queryFn: async () => rpcJson(await artistGet({ param: { username } })),
    queryKey: soundkitQueryKeys.artist(username),
  });

export const useArtistMediaQuery = (username: string) =>
  useQuery({
    enabled: Boolean(username),
    queryFn: async () => rpcJson(await artistMediaGet({ param: { username } })),
    queryKey: soundkitQueryKeys.artistMedia(username),
  });

export const useArtistsQuery = (query: ArtistRankingQuery = {}) =>
  useQuery({
    queryFn: async () => rpcJson(await artistsGet({ query })),
    queryKey: soundkitQueryKeys.artists(query),
  });

export const useArtistsInfiniteQuery = (query: ArtistRankingQuery = {}) => {
  const pageSize = Number(query.limit ?? 24);

  return useInfiniteQuery({
    getNextPageParam: (
      lastPage: ArtistSummary[],
      allPages: ArtistSummary[][]
    ) => {
      if (lastPage.length < pageSize) {
        return;
      }
      return allPages.length + 1;
    },
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) =>
      rpcJson(
        await artistsGet({
          query: {
            ...query,
            page: pageParam,
          },
        })
      ),
    queryKey: [...soundkitQueryKeys.artists(query), "infinite"],
  });
};

export const useFollowArtistMutation = (username: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<ArtistFollowResponse> =>
      rpcJson(await artistFollowPost({ param: { username } })),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.artist(username),
        }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.artists(),
        }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.notifications,
        }),
        queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.network }),
      ]),
  });
};

export const useUnfollowArtistMutation = (username: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<ArtistFollowResponse> =>
      rpcJson(await artistFollowDelete({ param: { username } })),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.artist(username),
        }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.artists(),
        }),
        queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.network }),
      ]),
  });
};

export const useArtistOnboardingMutation = () =>
  useMutation({
    mutationFn: async (body: ArtistOnboardingBody) =>
      rpcJson(await artistOnboardingPost({ json: body })),
  });

export const useFanOnboardingMutation = () =>
  useMutation({
    mutationFn: async (body: FanOnboardingBody) =>
      rpcJson(await fanOnboardingPost({ json: body })),
  });

export const useSearchQuery = (query: SearchQuery) =>
  useQuery({
    enabled: Boolean(
      (typeof query.q === "string" ? query.q.trim() : "") ||
      (typeof query.state === "string" ? query.state.trim() : "")
    ),
    queryFn: async () => rpcJson(await searchGet({ query })),
    queryKey: soundkitQueryKeys.search(query),
  });

export const useSemanticSearchQuery = (q: string, enabled = true) =>
  useQuery({
    enabled: enabled && q.trim().length >= 3,
    queryFn: async () =>
      rpcJson(await semanticSearchGet({ query: { limit: "6", q: q.trim() } })),
    queryKey: ["search", "semantic", q.trim()],
  });

export const useTracksQuery = (
  initialData?: TrackSummary[],
  query: PublicExploreQuery = {}
) =>
  useQuery({
    initialData,
    queryFn: async () => rpcJson(await tracksGet({ query })),
    queryKey: soundkitQueryKeys.tracks(query),
  });

export const useTracksInfiniteQuery = (query: PublicExploreQuery = {}) => {
  const pageSize = Number(query.limit ?? 24);

  return useInfiniteQuery({
    getNextPageParam: (
      lastPage: TrackSummary[],
      allPages: TrackSummary[][]
    ) => {
      if (lastPage.length < pageSize) {
        return;
      }
      return allPages.length + 1;
    },
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) =>
      rpcJson(
        await tracksGet({
          query: {
            ...query,
            page: pageParam,
          },
        })
      ),
    queryKey: [...soundkitQueryKeys.tracks(query), "infinite"],
  });
};

export const useTrackQuery = (trackId: string) =>
  useQuery({
    enabled: Boolean(trackId),
    queryFn: async () => rpcJson(await trackGet({ param: { trackId } })),
    queryKey: soundkitQueryKeys.track(trackId),
  });

export const useCreateTrackMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateTrackBody) =>
      rpcJson(await tracksPost({ json: body })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.tracksPrefix,
      }),
  });
};

export const useUpdateTrackMutation = (trackId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateTrackBody) =>
      rpcJson(await trackPatch({ json: body, param: { trackId } })),
    onError: (_error, _body, context) => {
      const rollback = context as OptimisticRollback | undefined;
      queryClient.setQueryData(
        soundkitQueryKeys.track(trackId),
        rollback?.previousTrack
      );
    },
    onMutate: async (body) => {
      await queryClient.cancelQueries({
        queryKey: soundkitQueryKeys.track(trackId),
      });
      const previousTrack = queryClient.getQueryData<TrackDetail>(
        soundkitQueryKeys.track(trackId)
      );
      if (previousTrack) {
        queryClient.setQueryData(soundkitQueryKeys.track(trackId), {
          ...previousTrack,
          ...body,
        });
      }
      return { previousTrack };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.tracksPrefix,
        }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.track(trackId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["track-detail", trackId],
        }),
      ]);
    },
  });
};

export const useRecoverTrackMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (trackId: string) =>
      rpcJson(await trackRecoverPost({ param: { trackId } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.tracks(),
      });
    },
  });
};

export const useDeleteTrackMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackId: string) =>
      rpcJson(await trackDelete({ param: { trackId } })),
    onError: (_error, _trackId, context) => {
      const rollback = context as OptimisticRollback | undefined;
      for (const [queryKey, tracks] of rollback?.previousTracks ?? []) {
        queryClient.setQueryData(queryKey, tracks);
      }
    },
    onMutate: async (trackId) => {
      await queryClient.cancelQueries({
        queryKey: soundkitQueryKeys.tracksPrefix,
      });
      const previousTracks = queryClient.getQueriesData<TrackSummary[]>({
        queryKey: soundkitQueryKeys.tracksPrefix,
      });
      queryClient.setQueriesData<TrackSummary[]>(
        { queryKey: soundkitQueryKeys.tracksPrefix },
        (tracks) => tracks?.filter((track) => track.id !== trackId)
      );
      return { previousTracks };
    },
    onSuccess: async (_, trackId) => {
      await queryClient.refetchQueries({
        queryKey: soundkitQueryKeys.tracksPrefix,
      });
      queryClient.removeQueries({
        queryKey: soundkitQueryKeys.track(trackId),
      });
      queryClient.removeQueries({
        queryKey: ["track-detail", trackId],
      });
    },
  });
};

export const useCreateTrackAssetMutation = (trackId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateTrackAssetBody) =>
      rpcJson(await trackAssetPost({ json: body, param: { trackId } })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.track(trackId),
      }),
  });
};

export const useSettleTrackMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      body,
      trackId,
    }: {
      body: SettleTrackBody;
      trackId: string;
    }) => rpcJson(await trackSettlePost({ json: body, param: { trackId } })),
    onSuccess: async (_, { trackId }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.tracksPrefix,
        }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.track(trackId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["track-detail", trackId],
        }),
      ]);
    },
  });
};

export const useTrackMediaProcessingQuery = (
  trackId: string,
  options: { enabled?: boolean } = {}
) =>
  useQuery({
    enabled: Boolean(trackId) && (options.enabled ?? true),
    queryFn: async () =>
      rpcJson(await trackMediaProcessingGet({ param: { trackId } })),
    queryKey: soundkitQueryKeys.trackMediaProcessing(trackId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "ready" || status === "partial" || status === "failed"
        ? false
        : 2000;
    },
  });

export const useRetryTrackMediaProcessingMutation = (trackId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      rpcJson(await trackMediaProcessingRetryPost({ param: { trackId } })),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.trackMediaProcessing(trackId),
        }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.track(trackId),
        }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.tracksPrefix,
        }),
      ]);
    },
  });
};

export const useProcessTrackMutation = (trackId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<TrackProcessingStatus> =>
      rpcJson(await trackProcessPost({ param: { trackId } })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.track(trackId),
      }),
  });
};

export const useCreateTrackLyricsMutation = (trackId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateLyricsRevisionBody) =>
      rpcJson(await trackLyricsPost({ json: body, param: { trackId } })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.track(trackId),
      }),
  });
};

export const useReviewTrackLyricsMutation = (trackId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      body,
      lyricsId,
    }: {
      body: ReviewLyricsRevisionBody;
      lyricsId: string;
    }) =>
      rpcJson(
        await trackLyricsReviewPatch({
          json: body,
          param: { lyricsId, trackId },
        })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.track(trackId),
      }),
  });
};

export const useProjectsQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await projectsGet()),
    queryKey: soundkitQueryKeys.projects,
  });

export const usePublicProjectsQuery = (query: PublicProjectsQuery = {}) =>
  useQuery<PublicProjectSummary[]>({
    queryFn: async () => rpcJson(await publicProjectsGet({ query })),
    queryKey: soundkitQueryKeys.publicProjects(query),
  });

export const useProjectQuery = (projectId: string) =>
  useQuery({
    enabled: Boolean(projectId),
    queryFn: async () => rpcJson(await projectGet({ param: { projectId } })),
    queryKey: soundkitQueryKeys.project(projectId),
  });

export const useAttachProjectLibraryAssetsMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: AttachProjectLibraryAssetsBody) =>
      rpcJson(
        await projectLibraryAssetsPost({
          json: body,
          param: { projectId },
        })
      ),
    onSuccess: async (project) => {
      queryClient.setQueryData(soundkitQueryKeys.project(projectId), project);
      await queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.projects,
      });
    },
  });
};

export const usePublicProjectQuery = (projectId: string) =>
  useQuery<PublicProjectDetail>({
    enabled: Boolean(projectId),
    queryFn: async () =>
      rpcJson(await publicProjectGet({ param: { projectId } })),
    queryKey: soundkitQueryKeys.publicProject(projectId),
  });

export const useCreateProjectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateProjectBody) =>
      rpcJson(await projectsPost({ json: body })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.projects }),
  });
};

export const useUpdateProjectMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateProjectBody) =>
      rpcJson(await projectPatch({ json: body, param: { projectId } })),
    onError: (_error, _body, context) => {
      const rollback = context as OptimisticRollback | undefined;
      queryClient.setQueryData(
        soundkitQueryKeys.project(projectId),
        rollback?.previousProject
      );
    },
    onMutate: async (body) => {
      await queryClient.cancelQueries({
        queryKey: soundkitQueryKeys.project(projectId),
      });
      const previousProject = queryClient.getQueryData<PublicProjectSummary>(
        soundkitQueryKeys.project(projectId)
      );
      if (previousProject) {
        queryClient.setQueryData(soundkitQueryKeys.project(projectId), {
          ...previousProject,
          ...body,
        });
      }
      return { previousProject };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.projects }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.project(projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.publicProject(projectId),
        }),
      ]);
    },
  });
};

export const useDeleteProjectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch(`${API_V1_URL}/projects/${projectId}`, {
        credentials: "include",
        method: "DELETE",
      });

      if (response.ok) {
        return response.json() as Promise<{ message: string }>;
      }

      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      throw new SoundKitApiError(
        payload?.message ?? `Project delete failed: ${response.status}`,
        response.status
      );
    },
    onError: (_error, _projectId, context) => {
      const rollback = context as OptimisticRollback | undefined;
      queryClient.setQueryData(
        soundkitQueryKeys.projects,
        rollback?.previousProjects
      );
    },
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({ queryKey: soundkitQueryKeys.projects });
      const previousProjects = queryClient.getQueryData<ProjectSummary[]>(
        soundkitQueryKeys.projects
      );
      queryClient.setQueryData<ProjectSummary[]>(
        soundkitQueryKeys.projects,
        (projects = []) =>
          projects.filter((project) => project.id !== projectId)
      );
      return { previousProjects };
    },
    onSuccess: async (_, projectId) => {
      await queryClient.refetchQueries({
        queryKey: soundkitQueryKeys.projects,
      });
      queryClient.removeQueries({
        queryKey: soundkitQueryKeys.project(projectId),
      });
      queryClient.removeQueries({
        queryKey: soundkitQueryKeys.publicProject(projectId),
      });
    },
  });
};

export const useCreateListeningPartyMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateListeningPartyBody) =>
      rpcJson(await listeningPartyPost({ json: body })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.listeningParties,
      }),
  });
};

export interface PublicRegionQuery {
  region?: string;
  regionType?: "global" | "north-america";
  scope?: "dashboard" | "public";
}

export const useListeningPartiesQuery = (query: PublicRegionQuery = {}) =>
  useQuery({
    queryFn: async () => rpcJson(await listeningPartiesGet({ query })),
    queryKey: [...soundkitQueryKeys.listeningParties, query],
  });

interface BattleDirectorySubscription {
  count: number;
  reconnectTimer: number | null;
  socket: WebSocket | null;
  stopped: boolean;
}

const battleDirectorySubscriptions = new WeakMap<
    QueryClient,
    BattleDirectorySubscription
  >(),
  subscribeToBattleDirectory = (queryClient: QueryClient) => {
    if (typeof window === "undefined") {
      return () => {};
    }

    const current = battleDirectorySubscriptions.get(queryClient);
    if (current) {
      current.count += 1;
      return () => {
        current.count -= 1;
        if (current.count === 0) {
          current.stopped = true;
          if (current.reconnectTimer !== null) {
            window.clearTimeout(current.reconnectTimer);
          }
          current.socket?.close();
          battleDirectorySubscriptions.delete(queryClient);
        }
      };
    }

    const connect = () => {
        if (subscription.stopped) {
          return;
        }

        const url = new URL(`${API_V1_URL}/battles/directory/ws`);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        const socket = new WebSocket(url.toString());
        subscription.socket = socket;
        socket.addEventListener("message", () => {
          void queryClient.invalidateQueries({
            queryKey: soundkitQueryKeys.battles,
          });
        });
        socket.addEventListener("close", () => {
          if (subscription.stopped || subscription.reconnectTimer !== null) {
            return;
          }
          subscription.reconnectTimer = window.setTimeout(() => {
            subscription.reconnectTimer = null;
            connect();
          }, 1000);
        });
        socket.addEventListener("error", () => socket.close(), { once: true });
      },
      subscription: BattleDirectorySubscription = {
        count: 1,
        reconnectTimer: null,
        socket: null,
        stopped: false,
      };

    battleDirectorySubscriptions.set(queryClient, subscription);
    connect();

    return () => {
      subscription.count -= 1;
      if (subscription.count === 0) {
        subscription.stopped = true;
        if (subscription.reconnectTimer !== null) {
          window.clearTimeout(subscription.reconnectTimer);
        }
        subscription.socket?.close();
        battleDirectorySubscriptions.delete(queryClient);
      }
    };
  };

export const useBattlesQuery = (query: PublicRegionQuery = {}) => {
  const queryClient = useQueryClient();
  useEffect(() => subscribeToBattleDirectory(queryClient), [queryClient]);

  return useQuery({
    queryFn: async () => rpcJson(await battlesGet({ query })),
    queryKey: [...soundkitQueryKeys.battles, query],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
};

export const useBattleOpponentsQuery = ({
  genre,
  q,
}: {
  genre: string;
  q: string;
}) => {
  const normalizedQuery = q.trim().replace(/^@+/u, "");
  return useQuery({
    enabled: normalizedQuery.length > 0,
    queryFn: async () =>
      rpcJson(
        await battleOpponentsGet({ query: { genre, q: normalizedQuery } })
      ),
    queryKey: ["battle-opponents", genre, normalizedQuery],
  });
};

export const usePublicLiveExperiencesQuery = (
  kind: "party" | "stream",
  query: PublicRegionQuery = {}
) =>
  useQuery({
    queryFn: async () =>
      rpcJson(await liveExperiencesGet({ query: { kind, ...query } })),
    queryKey: ["live", "experiences", kind, query],
    refetchInterval: 10_000,
  });

export const useMyLiveExperiencesQuery = (enabled = true) =>
  useQuery({
    enabled,
    queryFn: async () => rpcJson(await liveMyExperiencesGet()),
    queryKey: ["live", "experiences", "me"],
    refetchInterval: 5000,
  });

export const useLiveReviewCatalogQuery = (
  experienceId: string,
  query = "",
  enabled = true
) =>
  useQuery({
    enabled: enabled && experienceId.length > 0,
    queryFn: async () =>
      rpcJson(
        await liveExperienceReviewCatalogGet({
          param: { experienceId },
          query: query.trim() ? { q: query.trim() } : {},
        })
      ),
    queryKey: soundkitQueryKeys.liveReviewCatalog(experienceId, query),
  });

export const useCreateLiveOverlayTokenMutation = () =>
  useMutation({
    mutationFn: async (experienceId: string) =>
      rpcJson(
        await liveExperienceOverlayTokenPost({ param: { experienceId } })
      ),
  });

export const useSetLiveNowPlayingMutation = (roomId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: StreamNowPlayingBody) =>
      rpcJson(await liveRoomNowPlayingPost({ json: body, param: { roomId } })),
    onSuccess: (room) => {
      queryClient.setQueryData(liveRoomKey(roomId), room);
    },
  });
};

export const useSetStreamBotMutation = (roomId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: StreamBotBody) =>
      rpcJson(await liveRoomStreamBotPost({ json: body, param: { roomId } })),
    onSuccess: (room) => {
      queryClient.setQueryData(liveRoomKey(roomId), room);
    },
  });
};

export const useDeleteLiveExperienceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (experienceId: string) =>
      rpcJson(await liveExperienceDelete({ param: { experienceId } })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["live", "experiences"] }),
  });
};

export const useBattleChallengesQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await battleChallengesGet()),
    queryKey: soundkitQueryKeys.battleChallenges,
  });

export const useBattleKitsQuery = (query: BattleKitQuery = {}) =>
  useQuery<BattleKit[]>({
    queryFn: async () => rpcJson(await battleKitsGet({ query })),
    queryKey: [...soundkitQueryKeys.battleKits, query],
  });

export const useBattleKitQuery = (kitId: string) =>
  useQuery<BattleKit>({
    enabled: Boolean(kitId),
    queryFn: async () => rpcJson(await battleKitGet({ param: { kitId } })),
    queryKey: soundkitQueryKeys.battleKit(kitId),
  });

export const useCreateBattleKitMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: InferRequestType<typeof battleKitsPost>["json"]) =>
      rpcJson(await battleKitsPost({ json: body })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.battleKits,
      }),
  });
};

export const useUpdateBattleKitMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      kitId,
      ...body
    }: InferRequestType<typeof battleKitPatch>["json"] & { kitId: string }) =>
      rpcJson(await battleKitPatch({ json: body, param: { kitId } })),
    onSuccess: (kit) => {
      queryClient.setQueryData(soundkitQueryKeys.battleKit(kit.id), kit);
      return queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.battleKits,
      });
    },
  });
};

export const useDeleteBattleKitMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kitId: string) =>
      rpcJson(await battleKitDelete({ param: { kitId } })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.battleKits,
      }),
  });
};

export const useLibraryOverviewQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await libraryOverviewGet()),
    queryKey: soundkitQueryKeys.libraryOverview,
  });

export const useLibraryPurchasesQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await libraryPurchasesGet()),
    queryKey: soundkitQueryKeys.libraryPurchases,
  });

export const useLibraryPurchaseQuery = (purchaseId: string) =>
  useQuery({
    enabled: purchaseId.length > 0,
    queryFn: async (): Promise<LibraryPurchaseDetail> =>
      rpcJson(await libraryPurchaseGet({ param: { purchaseId } })),
    queryKey: soundkitQueryKeys.libraryPurchase(purchaseId),
    retry: false,
  });

export const useLibraryPlaylistsQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await libraryPlaylistsGet()),
    queryKey: soundkitQueryKeys.libraryPlaylists,
  });

export const useLibraryRecentQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await libraryRecentGet()),
    queryKey: soundkitQueryKeys.libraryRecent,
  });

export const useLibrarySavedQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await librarySavedGet()),
    queryKey: soundkitQueryKeys.librarySaved,
  });

export const useLibraryWatchedQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await libraryWatchedGet()),
    queryKey: soundkitQueryKeys.libraryWatched,
  });

export const useToggleSaveTrackMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackId: string) =>
      rpcJson(await librarySaveTrackPost({ param: { trackId } })),
    onMutate: async (trackId) => {
      await queryClient.cancelQueries({
        queryKey: soundkitQueryKeys.librarySaved,
      });
      return { trackId };
    },
    onSuccess: (result) => {
      queryClient.setQueryData<LibrarySavedTrack[]>(
        soundkitQueryKeys.librarySaved,
        (savedTracks = []) =>
          result.saved
            ? savedTracks
            : savedTracks.filter((track) => track.id !== result.trackId)
      );
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.librarySaved,
      });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.libraryOverview,
      });
    },
  });
};

export const useRemoveSavedTrackMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackId: string) =>
      rpcJson(await librarySaveTrackDelete({ param: { trackId } })),
    onSuccess: (_, trackId) => {
      queryClient.setQueryData<LibrarySavedTrack[]>(
        soundkitQueryKeys.librarySaved,
        (savedTracks = []) =>
          savedTracks.filter((track) => track.id !== trackId)
      );
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.librarySaved,
      });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.libraryOverview,
      });
    },
  });
};

export const useCreatePlaylistMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: { description?: string; title: string }) =>
      rpcJson(await libraryPlaylistsPost({ json: body })),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.libraryPlaylists,
      });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.libraryOverview,
      });
    },
  });
};

export const useDeletePlaylistMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (playlistId: string) =>
      rpcJson(await libraryPlaylistDelete({ param: { id: playlistId } })),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.libraryPlaylists,
      });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.libraryOverview,
      });
    },
  });
};

export const usePlaylistQuery = (id: string) =>
  useQuery({
    enabled: Boolean(id),
    queryFn: async () => rpcJson(await libraryPlaylistGet({ param: { id } })),
    queryKey: soundkitQueryKeys.libraryPlaylist(id),
  });

export const useAddPlaylistTrackMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playlistId,
      trackId,
    }: {
      playlistId: string;
      trackId: string;
    }) =>
      rpcJson(
        await libraryPlaylistTracksPost({
          json: { trackId },
          param: { id: playlistId },
        })
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.libraryPlaylist(variables.playlistId),
      });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.libraryPlaylists,
      });
    },
  });
};

export const useRemovePlaylistTrackMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playlistId,
      trackId,
    }: {
      playlistId: string;
      trackId: string;
    }) =>
      rpcJson(
        await libraryPlaylistTrackDelete({
          param: { id: playlistId, trackId },
        })
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.libraryPlaylist(variables.playlistId),
      });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.libraryPlaylists,
      });
    },
  });
};

export const useUpdateWorkspaceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: { name: string }) =>
      rpcJson(
        await apiClient.v1.me.workspace.$patch({
          json: { name },
        })
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.me }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.workspace,
        }),
      ]),
  });
};

export const useCreateWorkspaceInvitationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; role: "admin" | "member" }) =>
      rpcJson(await workspaceInvitePost({ json: body })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.workspace }),
  });
};

export const useRevokeWorkspaceInvitationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) =>
      rpcJson(await workspaceInvitationDelete({ param: { invitationId } })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.workspace }),
  });
};

export const useRemoveWorkspaceMemberMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) =>
      rpcJson(await workspaceMemberDelete({ param: { memberId } })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.workspace }),
  });
};

export const useCreateBattleChallengeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateBattleChallengeBody) =>
      rpcJson(await battleChallengePost({ json: body })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.battles });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.battleChallenges,
      });
    },
  });
};

export const useUpdateBattleChallengeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      challengeId,
      status,
    }: UpdateBattleChallengeBody & { challengeId: string }) =>
      rpcJson(
        await battleChallengePatch({
          json: { status },
          param: { challengeId },
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.battles });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.battleChallenges,
      });
    },
  });
};

export const useCreateLiveExperienceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      body: CreateLiveExperienceBody
    ): Promise<LiveExperienceCreateResponse> =>
      rpcJson(await liveExperiencePost({ json: body })),
    onSuccess: (experience) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.battles }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.listeningParties,
        }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.liveExperience(experience.experience.id),
        }),
        queryClient.invalidateQueries({
          queryKey: ["live", "experiences"],
        }),
      ]),
  });
};

export const useJoinLiveExperienceMutation = (experienceId: string) =>
  useMutation({
    mutationFn: async (
      body: JoinLiveExperienceBody
    ): Promise<LiveExperienceJoinResponse> =>
      rpcJson(
        await liveExperienceJoinPost({
          json: body,
          param: { experienceId },
        })
      ),
  });

export const useBattleBotActionMutation = (experienceId: string) =>
  useMutation({
    mutationFn: async (body: BattleBotActionBody) =>
      rpcJson(
        await liveExperienceBattleBotPost({
          json: body,
          param: { experienceId },
        })
      ),
  });

export const useLiveSessionLockCheckMutation = (experienceId: string) =>
  useMutation({
    mutationFn: async (body: LiveSessionLockCheckBody) =>
      rpcJson(
        await liveExperienceSessionLockCheckPost({
          json: body,
          param: { experienceId },
        })
      ),
  });

export type AnalyticsOverview = InferResponseType<
  typeof analyticsOverviewGet,
  200
>;

export interface AnalyticsTimeseriesPoint {
  date: string;
  label: string;
  value: number;
}

export interface AnalyticsTimeseries {
  metric: string;
  points: AnalyticsTimeseriesPoint[];
  range: string;
  total: number;
}

export interface AnalyticsTrackItem {
  averageListenPercent: number;
  completionRate: number;
  coverArtUrl: string | null;
  durationSeconds: number | null;
  estimatedEarningsCents: number;
  genre: string;
  plays: number;
  qualificationRate: number;
  qualifiedStreams: number;
  title: string;
  trackId: string;
  uniqueListeners: number;
}

export interface AnalyticsAudience {
  catalogDepth: number;
  listenersWithMultiTrackPlays: number;
  newListeners: number;
  premiumSupporters: number;
  returningListenerRate: number;
  returningListeners: number;
  totalUniqueListeners: number;
}

export interface AnalyticsSourceCategory {
  count: number;
  label: string;
  percentage: number;
  sourceType: string;
}

export interface AnalyticsSources {
  sources: AnalyticsSourceCategory[];
  total: number;
}

export interface AnalyticsLocationItem {
  city: string | null;
  countryCode: string | null;
  hasEnoughData: boolean;
  listeners: number;
  percentage: number;
  regionCode: string | null;
}

export interface AnalyticsLocations {
  hasEnoughData: boolean;
  locations: AnalyticsLocationItem[];
  totalListeners: number;
}

export interface AnalyticsLiveImpact {
  battlesParticipated: number;
  hasLiveActivity: boolean;
  listenersReached: number;
  listeningPartiesHosted: number;
  liveQualifiedStreams: number;
  liveStreamsHosted: number;
  tracksPlayedInLive: number;
}

export interface ArtistEarningsOverview {
  availableBalanceCents: number;
  categories: { amountCents: number; category: string; label: string }[];
  estimatedThisMonthCents: number;
  nextEstimatedPayoutDate: string;
  paidLifetimeCents: number;
  payoutMinimumCents: number;
  payoutProgressPercent: number;
  pendingReserveCents: number;
  statements: {
    creatorRewardsCents: number;
    monthLabel: string;
    musicSalesCents: number;
    periodEndsAt: string;
    periodStartsAt: string;
    plays: number;
    qualifiedStreams: number;
    tipsCents: number;
    totalEarningsCents: number;
  }[];
}

export const useAnalyticsOverviewQuery = () =>
  useQuery({
    queryFn: async (): Promise<AnalyticsOverview> =>
      rpcJson(await analyticsOverviewGet()),
    queryKey: soundkitQueryKeys.analyticsOverview,
  });

export const useAnalyticsTimeseriesQuery = (
  metric: "plays" | "qualified_streams" | "unique_listeners",
  range: "7d" | "28d" | "90d" | "12m"
) =>
  useQuery({
    queryFn: async (): Promise<AnalyticsTimeseries> =>
      rpcJson(
        await analyticsTimeseriesGet({
          query: { metric, range, scope: "platform" },
        })
      ),
    queryKey: ["analytics", "timeseries", metric, range],
  });

export const useAnalyticsTracksQuery = () =>
  useQuery({
    queryFn: async (): Promise<{ tracks: AnalyticsTrackItem[] }> =>
      rpcJson(await analyticsTracksGet()),
    queryKey: ["analytics", "tracks"],
  });

export const useAnalyticsAudienceQuery = () =>
  useQuery({
    queryFn: async (): Promise<AnalyticsAudience> =>
      rpcJson(await analyticsAudienceGet()),
    queryKey: ["analytics", "audience"],
  });

export const useAnalyticsSourcesQuery = () =>
  useQuery({
    queryFn: async (): Promise<AnalyticsSources> =>
      rpcJson(await analyticsSourcesGet()),
    queryKey: ["analytics", "sources"],
  });

export const useAnalyticsLocationsQuery = () =>
  useQuery({
    queryFn: async (): Promise<AnalyticsLocations> =>
      rpcJson(await analyticsLocationsGet()),
    queryKey: ["analytics", "locations"],
  });

export const useAnalyticsLiveImpactQuery = () =>
  useQuery({
    queryFn: async (): Promise<AnalyticsLiveImpact> =>
      rpcJson(await analyticsLiveImpactGet()),
    queryKey: ["analytics", "live-impact"],
  });

export const useArtistEarningsQuery = () =>
  useQuery({
    queryFn: async (): Promise<ArtistEarningsOverview> =>
      rpcJson(await analyticsEarningsGet()),
    queryKey: ["analytics", "earnings"],
  });

const defaultOpenVerseQuery: OpenVerseQuery = { limit: "10" };

export const useOpenVersesInfiniteQuery = (
  query: OpenVerseQuery = defaultOpenVerseQuery
) =>
  useInfiniteQuery({
    getNextPageParam: (lastPage: { nextCursor?: string | null }) =>
      lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      rpcJson(
        await openVersesGet({
          query: { ...query, cursor: pageParam },
        })
      ),
    queryKey: soundkitQueryKeys.openVerses(query),
  });

export const useOpenVerseQuery = (
  listingId: string,
  initialData?: OpenVerseListing
) =>
  useQuery({
    enabled: Boolean(listingId),
    initialData,
    queryFn: async () => rpcJson(await openVerseGet({ param: { listingId } })),
    queryKey: soundkitQueryKeys.openVerse(listingId),
  });

export const useCreateOpenVerseMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateOpenVerseBody) =>
      rpcJson(await openVersesPost({ json: body })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["open-verses"] }),
  });
};

export const useSubmitOpenVerseMutation = (listingId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateOpenVerseSubmissionBody) =>
      rpcJson(
        await openVerseSubmissionPost({
          json: body,
          param: { listingId },
        })
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["open-verses"] }),
        queryClient.invalidateQueries({
          queryKey: soundkitQueryKeys.openVerse(listingId),
        }),
      ]),
  });
};

export const useVideosQuery = (query: PublicExploreQuery = {}) =>
  useQuery({
    queryFn: async () => rpcJson(await videosGet({ query })),
    queryKey: soundkitQueryKeys.videos(query),
  });

export const useVideosInfiniteQuery = (query: PublicExploreQuery = {}) => {
  const pageSize = Number(query.limit ?? 24);

  return useInfiniteQuery({
    getNextPageParam: (
      lastPage: VideoSummary[],
      allPages: VideoSummary[][]
    ) => {
      if (lastPage.length < pageSize) {
        return;
      }
      return allPages.length + 1;
    },
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) =>
      rpcJson(
        await videosGet({
          query: {
            ...query,
            page: pageParam,
          },
        })
      ),
    queryKey: [...soundkitQueryKeys.videos(query), "infinite"],
  });
};

export const useCreateVideoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateVideoBody) =>
      rpcJson(await videosPost({ json: body })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.videosPrefix,
      }),
  });
};

export const useDeleteVideoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videoId: string) =>
      rpcJson(await videoDelete({ param: { videoId } })),
    onError: (_error, _videoId, context) => {
      const rollback = context as OptimisticRollback | undefined;
      for (const [queryKey, videos] of rollback?.previousVideos ?? []) {
        queryClient.setQueryData(queryKey, videos);
      }
    },
    onMutate: async (videoId) => {
      await queryClient.cancelQueries({
        queryKey: soundkitQueryKeys.videosPrefix,
      });
      const previousVideos = queryClient.getQueriesData<VideoSummary[]>({
        queryKey: soundkitQueryKeys.videosPrefix,
      });
      queryClient.setQueriesData<VideoSummary[]>(
        { queryKey: soundkitQueryKeys.videosPrefix },
        (videos) => videos?.filter((video) => video.id !== videoId)
      );
      return { previousVideos };
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.videosPrefix,
      }),
  });
};

export const useVideoQuery = (videoId: string) =>
  useQuery({
    enabled: videoId.length > 0,
    queryFn: async (): Promise<VideoDetail> =>
      rpcJson(await videoGet({ param: { videoId } })),
    queryKey: [...soundkitQueryKeys.videosPrefix, "detail", videoId],
  });

export const useVideoAnalyticsQuery = (
  videoId: string,
  range: "7d" | "28d" | "90d" | "12m" = "28d",
  enabled = true
) =>
  useQuery({
    enabled: enabled && videoId.length > 0,
    queryFn: async (): Promise<VideoAnalytics> =>
      rpcJson(
        await videoAnalyticsGet({ param: { videoId }, query: { range } })
      ),
    queryKey: [...soundkitQueryKeys.videosPrefix, "analytics", videoId, range],
  });

export const createVideoViewSession = async (
  videoId: string,
  body: VideoViewSessionStartBody
) =>
  rpcJson(
    await videoViewSessionPost({
      json: body,
      param: { videoId },
    })
  );

export const updateVideoViewSession = async (
  videoId: string,
  sessionId: string,
  body: VideoViewSessionProgressBody,
  ended = false
) =>
  rpcJson(
    await (ended ? videoViewSessionEndPost : videoViewSessionProgressPost)({
      json: body,
      param: { sessionId, videoId },
    })
  );

export const useVideoCommentsQuery = (videoId: string) =>
  useQuery({
    enabled: videoId.length > 0,
    queryFn: async (): Promise<VideoComment[]> =>
      rpcJson(await videoCommentsGet({ param: { videoId } })),
    queryKey: [...soundkitQueryKeys.videosPrefix, videoId, "comments"],
  });

export const useCreateVideoCommentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ body, videoId }: { body: string; videoId: string }) =>
      rpcJson(
        await videoCommentsPost({
          json: { body },
          param: { videoId },
        })
      ),
    onSuccess: (_comment, { videoId }) =>
      queryClient.invalidateQueries({
        queryKey: [...soundkitQueryKeys.videosPrefix, videoId, "comments"],
      }),
  });
};

export const useSellerStatusQuery = (enabled = true) =>
  useQuery({
    enabled,
    queryFn: async (): Promise<SellerStatus> =>
      rpcJson(await sellerStatusGet()),
    queryKey: soundkitQueryKeys.sellerStatus,
    refetchInterval: 15_000,
  });

export const useSellerAccountSessionQuery = (enabled = false) =>
  useQuery({
    enabled,
    queryFn: async (): Promise<SellerAccountSession> =>
      rpcJson(await sellerAccountSessionPost()),
    queryKey: ["seller", "account-session"],
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 4 * 60 * 1000,
  });

export const useSellerAccountLinkMutation = () =>
  useMutation({
    mutationFn: async (
      body: SellerAccountLinkBody
    ): Promise<SellerAccountLinkResponse> =>
      rpcJson(await sellerAccountLinkPost({ json: body })),
  });

export const useArtistSetupGuideQuery = (enabled = true) =>
  useQuery<ArtistSetupGuide>({
    enabled,
    queryFn: async () => rpcJson(await artistSetupGuideGet()),
    queryKey: soundkitQueryKeys.artistSetupGuide,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 5000,
  });

export const usePlatformInviteMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string): Promise<PlatformInviteResponse> =>
      rpcJson(await platformInvitePost({ json: { email } })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.artistSetupGuide,
      }),
  });
};

export const useBattleRecordQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await battleRecordGet()),
    queryKey: soundkitQueryKeys.battleRecord,
  });

export const useBattleStatsQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await battleStatsGet()),
    queryKey: soundkitQueryKeys.battlesStats,
  });

export const useTrackBattleHistoryQuery = (trackId: string) =>
  useQuery({
    queryFn: async () =>
      rpcJson(await trackBattleHistoryGet({ param: { trackId } })),
    queryKey: soundkitQueryKeys.trackBattleHistory(trackId),
  });

export const useNotificationsQuery = () =>
  useInfiniteQuery({
    getNextPageParam: (lastPage: NotificationPage) =>
      lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<NotificationPage> =>
      rpcJson(
        await notificationsGet({
          query: { cursor: pageParam, limit: 20 },
        })
      ),
    queryKey: soundkitQueryKeys.notifications,
  });

export const useMarkNotificationReadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) =>
      rpcJson(await notificationReadPost({ param: { notificationId } })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.notifications,
      }),
  });
};

export const useMarkNotificationsReadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => rpcJson(await notificationsReadAllPost()),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.notifications,
      }),
  });
};

export const useClearNotificationsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => rpcJson(await notificationsClearPost()),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.notifications,
      }),
  });
};

export const usePreSaveTrackMutation = (trackId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      rpcJson(await trackPreSavePost({ param: { trackId } })),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.track(trackId),
      });
    },
  });
};
