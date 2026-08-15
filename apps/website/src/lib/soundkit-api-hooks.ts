import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";

import { API_V1_URL, SoundKitApiError, apiClient, rpcJson } from "./api";

const meGet = apiClient.v1.me.index.$get,
 meProfilePatch = apiClient.v1.me.profile.$patch,
 meNotificationSettingsGet = apiClient.v1.me["notification-settings"].$get,
 meNotificationSettingsPatch =
  apiClient.v1.me["notification-settings"].$patch,
 meEntitlementsGet = apiClient.v1.me.entitlements.$get,
 billingCheckoutPost = apiClient.v1.billing.checkout.$post,
 adminAccessGet = apiClient.v1.admin.access.$get,
 adminSettingsGet = apiClient.v1.admin.settings.$get,
 adminSettingsPatch = apiClient.v1.admin.settings.$patch,
 adminFinancePaymentsGet = apiClient.v1.admin.finance.payments.$get,
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
 fanOnboardingPost = apiClient.v1.onboarding.fan.$post,
 discoverHomeGet = apiClient.v1.discover.home.$get,
 genresGet = apiClient.v1.discover.genres.$get,
 searchGet = apiClient.v1.search.$get,
 tracksGet = apiClient.v1.tracks.index.$get,
 tracksPost = apiClient.v1.tracks.index.$post,
 trackGet = apiClient.v1.tracks[":trackId"].$get,
 trackPatch = apiClient.v1.tracks[":trackId"].$patch,
 trackDelete = apiClient.v1.tracks[":trackId"].$delete,
 trackAssetPost = apiClient.v1.tracks[":trackId"].assets.$post,
 trackSettlePost = apiClient.v1.tracks[":trackId"].settle.$post,
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
 listeningPartyPost = apiClient.v1["listening-parties"].index.$post,
 listeningPartiesGet = apiClient.v1["listening-parties"].index.$get,
 battlesGet = apiClient.v1.battles.index.$get,
 battleChallengesGet = apiClient.v1.battles.challenges.index.$get,
 battleChallengePost = apiClient.v1.battles.challenge.$post,
 battleChallengePatch =
  apiClient.v1.battles.challenges[":challengeId"].$patch,
 liveExperiencesGet = apiClient.v1.live.experiences.public.$get,
 liveExperiencePost = apiClient.v1.live.experiences.index.$post,
 liveExperienceJoinPost =
  apiClient.v1.live.experiences[":experienceId"].join.$post,
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
 videoCommentsGet = apiClient.v1.videos[":videoId"].comments.$get,
 videoCommentsPost = apiClient.v1.videos[":videoId"].comments.$post,
 videoDelete = apiClient.v1.videos[":videoId"].$delete,
 notificationsGet = apiClient.v1.notifications.index.$get,
 notificationsReadAllPost = apiClient.v1.notifications["read-all"].$post,
 trackPreSavePost = apiClient.v1.tracks[":trackId"]["pre-save"].$post,
 artistFollowPost = apiClient.v1.social.artists[":username"].follow.$post,
 sellerStatusGet = apiClient.v1.seller.status.$get,
 battleStatsGet = apiClient.v1.battles.stats.$get,
 trackBattleHistoryGet =
  apiClient.v1.battles["track-history"][":trackId"].$get;

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
type UpdateTrackBody = InferRequestType<typeof trackPatch>["json"];
type CreateTrackAssetBody = InferRequestType<typeof trackAssetPost>["json"];
type SettleTrackBody = InferRequestType<typeof trackSettlePost>["json"];
type TrackProcessingStatus = InferResponseType<typeof trackProcessPost, 200>;
type CreateLyricsRevisionBody = InferRequestType<
  typeof trackLyricsPost
>["json"];
type ReviewLyricsRevisionBody = InferRequestType<
  typeof trackLyricsReviewPatch
>["json"];
type CreateProjectBody = InferRequestType<typeof projectsPost>["json"];
type UpdateProjectBody = InferRequestType<typeof projectPatch>["json"];
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
export type VideoComment = InferResponseType<
  typeof videoCommentsGet,
  200
>[number];
export type ArtistSummary = InferResponseType<typeof artistsGet, 200>[number];
type ArtistFollowResponse = InferResponseType<typeof artistFollowPost, 200>;
type SellerStatus = InferResponseType<typeof sellerStatusGet, 200>;
export type MeSummary = InferResponseType<typeof meGet, 200>;
type EntitlementSummary = InferResponseType<typeof meEntitlementsGet, 200>;
type BillingCheckoutBody = InferRequestType<typeof billingCheckoutPost>["json"];
export type BillingCheckoutResponse = InferResponseType<
  typeof billingCheckoutPost,
  200
>;
type UpdateMeProfileBody = InferRequestType<typeof meProfilePatch>["json"];
type UpdateNotificationSettingsBody = InferRequestType<
  typeof meNotificationSettingsPatch
>["json"];
export type BattleSummary = InferResponseType<typeof battlesGet, 200>[number];
export type BattleChallengesResponse = InferResponseType<
  typeof battleChallengesGet,
  200
>;
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
type CreateBattleChallengeBody = InferRequestType<
  typeof battleChallengePost
>["json"];
type UpdateBattleChallengeBody = InferRequestType<
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
export type ListeningPartySummary = InferResponseType<
  typeof listeningPartiesGet,
  200
>[number];
export type FriendSummary = InferResponseType<typeof friendsGet, 200>[number];
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
type UpdatePlatformSettingsBody = InferRequestType<
  typeof adminSettingsPatch
>["json"];

export type AdTargetType = "country" | "state";
export type AdCreativeFormat = "audio" | "image" | "video";
export type AdPlacement = "audio_preroll" | "video_overlay" | "video_preroll";
export type AdBillingType = "prepaid_wallet" | "upfront_recurring";

export interface AdTarget {
  targetCode: string;
  targetType: AdTargetType;
}

export interface AdCampaignSummary {
  billingType: AdBillingType;
  clickthroughUrl: string;
  creativeFormat: AdCreativeFormat;
  creativeImageUrl: string | null;
  creativeUrl: string;
  dailyBudgetCents: number;
  dailyImpressionCap: number;
  endDate: string | null;
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
  status: "active" | "draft" | "exhausted_for_today" | "expired" | "paused";
  targets: AdTarget[];
}

export interface AdWalletSummary {
  balanceCents: number;
  currency: string;
}

export interface CreateAdCampaignBody {
  billingType: AdBillingType;
  clickthroughUrl: string;
  creativeFormat: AdCreativeFormat;
  creativeImageUrl?: string;
  creativeUrl: string;
  dailyBudgetCents: number;
  dailyImpressionCap: number;
  endDate?: string;
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
  adminSettings: ["admin", "settings"] as const,
  artist: (username: string) => ["artists", username] as const,
  artists: (query?: ArtistRankingQuery) => ["artists", query ?? {}] as const,
  battleChallenges: ["battles", "challenges"] as const,
  battles: ["battles"] as const,
  battlesStats: ["battles", "stats"] as const,
  billingPlans: ["billing", "plans"] as const,
  conversationMessages: (conversationId: string) =>
    ["messages", "conversations", conversationId, "messages"] as const,
  conversations: ["messages", "conversations"] as const,
  discoverHome: ["discover", "home"] as const,
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
  me: ["me"] as const,
  meEntitlements: ["me", "entitlements"] as const,
  meNotificationSettings: ["me", "notification-settings"] as const,
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
  tracks: (query?: PublicExploreQuery) =>
    [...soundkitQueryKeys.tracksPrefix, query ?? {}] as const,
  tracksPrefix: ["tracks"] as const,
  videos: (query?: PublicExploreQuery) =>
    [...soundkitQueryKeys.videosPrefix, query ?? {}] as const,
  videosPrefix: ["videos"] as const,
};

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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateAdCampaignBody) =>
      fetchApiJson<AdCampaignSummary>("/ads/campaigns", {
        body: JSON.stringify(body),
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.adCampaigns,
      });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.adAdminCampaigns,
      });
    },
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

export const useAdminSettingsQuery = (enabled = true) =>
  useQuery({
    enabled,
    queryFn: async () => rpcJson(await adminSettingsGet()),
    queryKey: soundkitQueryKeys.adminSettings,
  });

export const useUpdateAdminSettingsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdatePlatformSettingsBody) =>
      rpcJson(await adminSettingsPatch({ json: body })),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.adminSettings,
      });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.discoverHome,
      });
    },
  });
};

export const useImportStripePlanMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: ImportStripePlanBody) =>
      rpcJson(await adminImportStripePlanPost({ json: body })),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.adminPayments,
      });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.adminOverview,
      });
    },
  });
};

export const useSyncStripePlansMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: SyncStripePlansBody = {}) =>
      rpcJson(await adminSyncStripePlansPost({ json: body })),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.adminPayments,
      });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.adminOverview,
      });
    },
  });
};

export const useBackfillTrackDurationsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: BackfillTrackDurationsBody) =>
      rpcJson(await adminBackfillTrackDurationsPost({ json: body })),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.adminOverview,
      });
    },
  });
};

export const useTrackDurationBackfillStatusQuery = (
  runId: string | null,
  enabled = true
) =>
  useQuery({
    enabled: enabled && Boolean(runId),
    queryFn: async () =>
      rpcJson(
        await adminBackfillTrackDurationsStatusGet({
          query: { runId: runId ?? "" },
        })
      ),
    queryKey: ["admin", "tracks", "backfill-durations", "status", runId],
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.me }),
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
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.meNotificationSettings,
      }),
  });
};

export const useMeEntitlementsQuery = () =>
  useQuery({
    queryFn: async (): Promise<EntitlementSummary> =>
      rpcJson(await meEntitlementsGet()),
    queryKey: soundkitQueryKeys.meEntitlements,
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

export const useFriendsQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await friendsGet()),
    queryKey: soundkitQueryKeys.friends,
  });

export const useFriendRequestsQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await friendRequestsGet()),
    queryKey: soundkitQueryKeys.friendRequests,
  });

export const useCreateFriendRequestMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: { message?: string; username: string }) =>
      rpcJson(await friendRequestsPost({ json: body })),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.friendRequests,
      });
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.friends });
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.friendRequests,
      });
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.friends });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.conversations,
      });
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

export const useConversationsQuery = (enabled = true) =>
  useQuery<ConversationSummary[]>({
    enabled,
    queryFn: async () => rpcJson(await conversationsGet()),
    queryKey: soundkitQueryKeys.conversations,
  });

export const useConversationMessagesQuery = (conversationId: string) =>
  useQuery<MessageSummary[]>({
    enabled: Boolean(conversationId),
    queryFn: async () =>
      rpcJson(await conversationMessagesGet({ param: { conversationId } })),
    queryKey: soundkitQueryKeys.conversationMessages(conversationId),
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

export const useStartConversationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversation,
      message,
    }: {
      conversation: CreateConversationBody;
      message?: CreateMessageBody;
    }): Promise<ConversationSummary> => {
      const createdConversation = await rpcJson(
        await conversationsPost({ json: conversation })
      );
      if (message?.body && message.body.trim()) {
        await rpcJson(
          await conversationMessagesPost({
            json: message,
            param: { conversationId: createdConversation.id },
          })
        );
      }
      return createdConversation;
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.conversationMessages(conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.conversations,
      });
    },
  });
};

export const useArtistQuery = (username: string) =>
  useQuery({
    enabled: Boolean(username),
    queryFn: async () => rpcJson(await artistGet({ param: { username } })),
    queryKey: soundkitQueryKeys.artist(username),
  });

export const useArtistsQuery = (query: ArtistRankingQuery = {}) =>
  useQuery({
    queryFn: async () => rpcJson(await artistsGet({ query })),
    queryKey: soundkitQueryKeys.artists(query),
  });

export const useFollowArtistMutation = (username: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<ArtistFollowResponse> =>
      rpcJson(await artistFollowPost({ param: { username } })),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.artist(username),
      });
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.artists() });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.notifications,
      });
    },
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

export const useDiscoverHomeQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await discoverHomeGet()),
    queryKey: soundkitQueryKeys.discoverHome,
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.tracksPrefix,
      });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.track(trackId),
      });
    },
  });
};

export const useDeleteTrackMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackId: string) =>
      rpcJson(await trackDelete({ param: { trackId } })),
    onSuccess: (_, trackId) => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.tracksPrefix,
      });
      queryClient.refetchQueries({
        queryKey: soundkitQueryKeys.tracksPrefix,
      });
      queryClient.removeQueries({
        queryKey: soundkitQueryKeys.track(trackId),
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
    onSuccess: (_, { trackId }) => {
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.tracksPrefix,
      });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.track(trackId),
      });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.projects });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.project(projectId),
      });
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
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.projects });
      queryClient.refetchQueries({ queryKey: soundkitQueryKeys.projects });
      queryClient.removeQueries({
        queryKey: soundkitQueryKeys.project(projectId),
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

export const useListeningPartiesQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await listeningPartiesGet()),
    queryKey: soundkitQueryKeys.listeningParties,
  });

export const useBattlesQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await battlesGet()),
    queryKey: soundkitQueryKeys.battles,
  });

export const usePublicLiveExperiencesQuery = (kind: "party" | "stream") =>
  useQuery({
    queryFn: async () => rpcJson(await liveExperiencesGet({ query: { kind } })),
    queryKey: ["live", "experiences", kind],
    refetchInterval: 10_000,
  });

export const useBattleChallengesQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await battleChallengesGet()),
    queryKey: soundkitQueryKeys.battleChallenges,
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.me });
    },
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
    onSuccess: (experience) => {
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.battles });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.listeningParties,
      });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.liveExperience(experience.experience.id),
      });
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["open-verses"] });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.openVerse(listingId),
      });
    },
  });
};

export const useVideosQuery = (query: PublicExploreQuery = {}) =>
  useQuery({
    queryFn: async () => rpcJson(await videosGet({ query })),
    queryKey: soundkitQueryKeys.videos(query),
  });

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

export const useSellerStatusQuery = () =>
  useQuery({
    queryFn: async (): Promise<SellerStatus> =>
      rpcJson(await sellerStatusGet()),
    queryKey: soundkitQueryKeys.sellerStatus,
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
  useQuery({
    queryFn: async () => rpcJson(await notificationsGet()),
    queryKey: soundkitQueryKeys.notifications,
  });

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
