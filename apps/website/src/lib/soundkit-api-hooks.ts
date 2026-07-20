import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";

import { apiClient, rpcJson } from "./api";

const meGet = apiClient.v1.me.index.$get;
const meProfilePatch = apiClient.v1.me.profile.$patch;
const meEntitlementsGet = apiClient.v1.me.entitlements.$get;
const billingCheckoutPost = apiClient.v1.billing.checkout.$post;
const adminAccessGet = apiClient.v1.admin.access.$get;
const adminFinancePaymentsGet = apiClient.v1.admin.finance.payments.$get;
const adminImportStripePlanPost =
  apiClient.v1.admin.finance.payments["import-plan"].$post;
const adminOverviewGet = apiClient.v1.admin.overview.$get;
const adminSyncStripePlansPost =
  apiClient.v1.admin.finance.payments["sync-plans"].$post;
const artistOnboardingPost = apiClient.v1.onboarding.artist.$post;
const artistsGet = apiClient.v1.artists.index.$get;
const artistGet = apiClient.v1.artists[":username"].$get;
const fanOnboardingPost = apiClient.v1.onboarding.fan.$post;
const searchGet = apiClient.v1.search.$get;
const tracksGet = apiClient.v1.tracks.index.$get;
const tracksPost = apiClient.v1.tracks.index.$post;
const trackGet = apiClient.v1.tracks[":trackId"].$get;
const trackPatch = apiClient.v1.tracks[":trackId"].$patch;
const trackAssetPost = apiClient.v1.tracks[":trackId"].assets.$post;
const trackProcessPost = apiClient.v1.tracks[":trackId"].process.$post;
const projectsGet = apiClient.v1.projects.index.$get;
const projectsPost = apiClient.v1.projects.index.$post;
const projectGet = apiClient.v1.projects[":projectId"].$get;
const projectPatch = apiClient.v1.projects[":projectId"].$patch;
const listeningPartyPost = apiClient.v1["listening-parties"].index.$post;
const listeningPartiesGet = apiClient.v1["listening-parties"].index.$get;
const battlesGet = apiClient.v1.battles.index.$get;
const battleChallengePost = apiClient.v1.battles.challenge.$post;
const libraryOverviewGet = apiClient.v1.library.overview.$get;
const libraryPlaylistsGet = apiClient.v1.library.playlists.$get;
const libraryPurchasesGet = apiClient.v1.library.purchases.$get;
const libraryRecentGet = apiClient.v1.library.recent.$get;
const librarySavedGet = apiClient.v1.library.saved.$get;
const libraryWatchedGet = apiClient.v1.library.watched.$get;
const friendsGet = apiClient.v1.messages.friends.$get;
const peopleSearchGet = apiClient.v1.messages.people.$get;
const conversationsGet = apiClient.v1.messages.conversations.$get;
const conversationsPost = apiClient.v1.messages.conversations.$post;
const conversationMessagesGet =
  apiClient.v1.messages.conversations[":conversationId"].messages.$get;
const conversationMessagesPost =
  apiClient.v1.messages.conversations[":conversationId"].messages.$post;
const openVersesGet = apiClient.v1["open-verses"].index.$get;
const openVersesPost = apiClient.v1["open-verses"].index.$post;
const openVerseGet = apiClient.v1["open-verses"][":listingId"].$get;
const openVerseSubmissionPost =
  apiClient.v1["open-verses"][":listingId"].submissions.$post;
const videosGet = apiClient.v1.videos.index.$get;
const videosPost = apiClient.v1.videos.index.$post;
const sellerStatusGet = apiClient.v1.seller.status.$get;
const battleStatsGet = apiClient.v1.battles.stats.$get;
const trackBattleHistoryGet =
  apiClient.v1.battles["track-history"][":trackId"].$get;

type ArtistOnboardingBody = InferRequestType<
  typeof artistOnboardingPost
>["json"];
type FanOnboardingBody = InferRequestType<typeof fanOnboardingPost>["json"];
type SearchQuery = InferRequestType<typeof searchGet>["query"];
type ArtistRankingQuery = InferRequestType<typeof artistsGet>["query"];
type PublicExploreQuery = InferRequestType<typeof tracksGet>["query"];
export type TrackSummary = InferResponseType<typeof tracksGet, 200>[number];
type CreateTrackBody = InferRequestType<typeof tracksPost>["json"];
type UpdateTrackBody = InferRequestType<typeof trackPatch>["json"];
type CreateTrackAssetBody = InferRequestType<typeof trackAssetPost>["json"];
type TrackProcessingStatus = InferResponseType<typeof trackProcessPost, 200>;
type CreateProjectBody = InferRequestType<typeof projectsPost>["json"];
type UpdateProjectBody = InferRequestType<typeof projectPatch>["json"];
export type ProjectSummary = InferResponseType<typeof projectsGet, 200>[number];
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
export type ArtistSummary = InferResponseType<typeof artistsGet, 200>[number];
type SellerStatus = InferResponseType<typeof sellerStatusGet, 200>;
export type MeSummary = InferResponseType<typeof meGet, 200>;
type EntitlementSummary = InferResponseType<typeof meEntitlementsGet, 200>;
type BillingCheckoutBody = InferRequestType<typeof billingCheckoutPost>["json"];
export type BillingCheckoutResponse = InferResponseType<
  typeof billingCheckoutPost,
  200
>;
type UpdateMeProfileBody = InferRequestType<typeof meProfilePatch>["json"];
export type BattleSummary = InferResponseType<typeof battlesGet, 200>[number];
export type LibraryOverview = InferResponseType<typeof libraryOverviewGet, 200>;
export type LibraryPlaylist = InferResponseType<
  typeof libraryPlaylistsGet,
  200
>[number];
export type LibraryPurchase = InferResponseType<
  typeof libraryPurchasesGet,
  200
>[number];
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
export type ListeningPartySummary = InferResponseType<
  typeof listeningPartiesGet,
  200
>[number];
export type FriendSummary = InferResponseType<typeof friendsGet, 200>[number];
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

export const soundkitQueryKeys = {
  adminAccess: ["admin", "access"] as const,
  adminOverview: ["admin", "overview"] as const,
  adminPayments: ["admin", "payments"] as const,
  artist: (username: string) => ["artists", username] as const,
  artists: (query?: ArtistRankingQuery) => ["artists", query ?? {}] as const,
  battles: ["battles"] as const,
  battlesStats: ["battles", "stats"] as const,
  billingPlans: ["billing", "plans"] as const,
  conversationMessages: (conversationId: string) =>
    ["messages", "conversations", conversationId, "messages"] as const,
  conversations: ["messages", "conversations"] as const,
  friends: ["messages", "friends"] as const,
  peopleSearch: (q: string) => ["messages", "people", q] as const,
  libraryOverview: ["library", "overview"] as const,
  libraryPlaylists: ["library", "playlists"] as const,
  libraryPurchases: ["library", "purchases"] as const,
  libraryRecent: ["library", "recent"] as const,
  librarySaved: ["library", "saved"] as const,
  libraryWatched: ["library", "watched"] as const,
  listeningParties: ["listening-parties"] as const,
  me: ["me"] as const,
  meEntitlements: ["me", "entitlements"] as const,
  openVerse: (id: string) => ["open-verses", id] as const,
  openVerses: (query?: OpenVerseQuery) => ["open-verses", query ?? {}] as const,
  project: (id: string) => ["projects", id] as const,
  projects: ["projects"] as const,
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

export const useConversationsQuery = () =>
  useQuery<ConversationSummary[]>({
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
      message: CreateMessageBody;
    }): Promise<ConversationSummary> => {
      const createdConversation = await rpcJson(
        await conversationsPost({ json: conversation })
      );
      await rpcJson(
        await conversationMessagesPost({
          json: message,
          param: { conversationId: createdConversation.id },
        })
      );
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

export const useProcessTrackMutation = (trackId: string) =>
  useMutation({
    mutationFn: async (): Promise<TrackProcessingStatus> =>
      rpcJson(await trackProcessPost({ param: { trackId } })),
  });

export const useProjectsQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await projectsGet()),
    queryKey: soundkitQueryKeys.projects,
  });

export const useProjectQuery = (projectId: string) =>
  useQuery({
    enabled: Boolean(projectId),
    queryFn: async () => rpcJson(await projectGet({ param: { projectId } })),
    queryKey: soundkitQueryKeys.project(projectId),
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

export const useCreateBattleChallengeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateBattleChallengeBody) =>
      rpcJson(await battleChallengePost({ json: body })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.battles }),
  });
};

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
