/* eslint-disable one-var, sort-vars, react/preserve-manual-memoization, react/hook-use-state, typescript/no-invalid-void-type, promise/prefer-await-to-then, unicorn/prefer-ternary */
import { BasicIndex } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import {
  createCollection,
  createOptimisticAction,
  useLiveInfiniteQuery,
  useLiveQuery,
} from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { z } from "zod";

import { API_V1_URL, apiClient, rpcJson } from "./api";
import { reconcileCollections } from "./mutation-reconciliation";
import { soundkitQueryKeys } from "./soundkit-api-hooks";
import type {
  CreateBattleChallengeBody,
  LibrarySavedTrack,
} from "./soundkit-api-hooks";

const notificationsGet = apiClient.v1.notifications.index.$get,
  notificationReadPost =
    apiClient.v1.notifications[":notificationId"].read.$post,
  notificationsReadAllPost = apiClient.v1.notifications["read-all"].$post,
  notificationsClearPost = apiClient.v1.notifications.clear.$post,
  videoCommentsGet = apiClient.v1.videos[":videoId"].comments.$get,
  videoCommentsPost = apiClient.v1.videos[":videoId"].comments.$post,
  librarySavedGet = apiClient.v1.library.saved.$get,
  librarySaveTrackPost = apiClient.v1.library.saved[":trackId"].$post,
  librarySaveTrackDelete = apiClient.v1.library.saved[":trackId"].$delete,
  libraryPlaylistsGet = apiClient.v1.library.playlists.$get,
  libraryPlaylistsPost = apiClient.v1.library.playlists.$post,
  libraryPlaylistDelete = apiClient.v1.library.playlists[":id"].$delete,
  libraryPlaylistGet = apiClient.v1.library.playlists[":id"].$get,
  libraryPlaylistTracksPost =
    apiClient.v1.library.playlists[":id"].tracks.$post,
  libraryPlaylistTrackDelete =
    apiClient.v1.library.playlists[":id"].tracks[":trackId"].$delete,
  communitiesGet = apiClient.v1.communities.index.$get,
  communityPost = apiClient.v1.communities.index.$post,
  communityPatch = apiClient.v1.communities[":communityId"].$patch,
  communityJoinPost = apiClient.v1.communities[":communityId"].join.$post,
  communityPostsGet = apiClient.v1.communities[":communityId"].posts.$get,
  communityPostsPost = apiClient.v1.communities[":communityId"].posts.$post,
  communityMessagesGet = apiClient.v1.communities[":communityId"].messages.$get,
  communityMessagesPost =
    apiClient.v1.communities[":communityId"].messages.$post,
  communityMembersGet = apiClient.v1.communities[":communityId"].members.$get,
  communityBansGet = apiClient.v1.communities[":communityId"].bans.$get,
  communityMemberPatch =
    apiClient.v1.communities[":communityId"].members[":userId"].$patch,
  communityMemberDelete =
    apiClient.v1.communities[":communityId"].members[":userId"].$delete,
  communityMemberBanPost =
    apiClient.v1.communities[":communityId"].members[":userId"].ban.$post,
  communityBanDelete =
    apiClient.v1.communities[":communityId"].bans[":userId"].$delete,
  artistFollowPost = apiClient.v1.social.artists[":username"].follow.$post,
  artistFollowDelete = apiClient.v1.social.artists[":username"].follow.$delete,
  battlesGet = apiClient.v1.battles.index.$get,
  battleDelete = apiClient.v1.battles[":battleId"].$delete,
  battleChallengesGet = apiClient.v1.battles.challenges.$get,
  battleChallengePost = apiClient.v1.battles.challenge.$post,
  battleChallengePatch = apiClient.v1.battles.challenges[":challengeId"].$patch,
  battleChallengeDelete =
    apiClient.v1.battles.challenges[":challengeId"].$delete,
  notificationSchema = z.object({
    createdAt: z.string(),
    id: z.string(),
    link: z.string().nullable(),
    message: z.string(),
    read: z.boolean(),
    title: z.string(),
    type: z.string(),
  }),
  videoCommentSchema = z.object({
    authorAvatarUrl: z.string().nullable(),
    authorName: z.string().nullable(),
    authorUsername: z.string().nullable(),
    body: z.string(),
    createdAt: z.string(),
    id: z.string(),
    parentCommentId: z.string().nullable(),
    userId: z.string(),
  }),
  savedTrackIdSchema = z.object({ id: z.string() }),
  followingSchema = z.object({
    accountType: z.enum(["artist", "fan"]),
    avatarUrl: z.string().nullable(),
    canMessage: z.boolean(),
    email: z.string().nullable(),
    followsYou: z.boolean(),
    id: z.string(),
    isFollowing: z.boolean(),
    isFriend: z.boolean(),
    name: z.string(),
    username: z.string().nullable(),
  }),
  playlistSchema = z.object({
    description: z.string().nullable(),
    id: z.string(),
    isPublic: z.boolean(),
    title: z.string(),
    trackCount: z.number(),
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
  playlistTrackSchema = z.object({
    artist: z.string(),
    artistSlug: z.string(),
    cover: z.string(),
    duration: z.string(),
    genre: z.string().nullable(),
    id: z.string(),
    regionSlug: z.string().nullable(),
    slug: z.string().nullable(),
    title: z.string(),
  }),
  battleChallengeSchema = z.object({
    challengerUsername: z.string().nullable(),
    createdAt: z.string(),
    direction: z.enum(["incoming", "outgoing"]),
    expiresAt: z.string(),
    format: z.enum(["best_of_3", "best_of_5", "best_of_7"]),
    genre: z.string(),
    id: z.string(),
    message: z.string().nullable(),
    opponentUsername: z.string().nullable(),
    proposedDate: z.string().nullable(),
    proposedTimeLabel: z.string().nullable(),
    status: z.enum(["pending", "accepted", "declined", "canceled", "expired"]),
  }),
  battleParticipantSchema = z.object({
    avatarUrl: z.string().nullable(),
    id: z.string(),
    name: z.string(),
    username: z.string().nullable(),
  }),
  battleSummarySchema = z.object({
    featuredRank: z.number().int().positive().nullable().optional(),
    format: z.enum(["best_of_3", "best_of_5", "best_of_7"]),
    genre: z.string(),
    id: z.string(),
    isFeatured: z.boolean(),
    joinMode: z.enum(["watch_now", "waiting_room"]),
    participants: battleParticipantSchema.array().max(2),
    phaseEndsAt: z.string().nullable().optional(),
    queueSize: z.number().int().nonnegative(),
    round: z
      .object({
        current: z.number().int().positive(),
        id: z.string(),
        isVoting: z.boolean(),
        status: z.enum(["upcoming", "active", "completed"]),
        total: z.number().int().positive(),
      })
      .nullable()
      .optional(),
    startsAt: z.string().nullable().optional(),
    status: z.enum(["scheduled", "live", "completed", "archived"]),
    title: z.string(),
    tracks: z
      .object({
        artist: z.string(),
        cover: z.string().nullable(),
        id: z.string(),
        title: z.string(),
        votes: z.number().int().nonnegative(),
      })
      .array()
      .max(2),
    viewerCount: z.number(),
    visibility: z.enum(["public", "premium_only"]),
  });

export type DbBattleChallenge = z.infer<typeof battleChallengeSchema>;
export type DbBattleSummary = z.infer<typeof battleSummarySchema>;
export type DbNotification = z.infer<typeof notificationSchema>;
export type DbVideoComment = z.infer<typeof videoCommentSchema>;
export type DbFollowing = z.infer<typeof followingSchema>;
export type DbCommunity = z.infer<typeof communitySchema>;
export type DbCommunityPost = z.infer<typeof communityPostSchema>;
export type DbCommunityMessage = z.infer<typeof communityMessageSchema>;
export type DbCommunityMember = z.infer<typeof communityMemberSchema>;
export type DbCommunityBan = z.infer<typeof communityBanSchema>;

const notificationStatsSchema = z.object({
  id: z.literal("summary"),
  unreadCount: z.number().int().nonnegative(),
});

interface NotificationCollectionRef {
  utils: { refetch: () => Promise<unknown> };
}

const reconcileNotificationState = async (
    collection: NotificationCollectionRef,
    notificationStats: NotificationCollectionRef,
    queryClient: QueryClient
  ) => {
    await Promise.all([
      reconcileCollections(collection, notificationStats),
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.notifications,
      }),
    ]);
  },
  runNotificationMutation = async ({
    collection,
    notificationStats,
    queryClient,
    request,
  }: {
    collection: NotificationCollectionRef;
    notificationStats: NotificationCollectionRef;
    queryClient: QueryClient;
    request: () => Promise<unknown>;
  }) => {
    try {
      await request();
    } catch (error) {
      // A failed request can race with an incoming notification. Refresh the
      // authoritative collections before the optimistic transaction rolls
      // back so that the rollback never becomes the final state.
      await Promise.allSettled([
        reconcileNotificationState(collection, notificationStats, queryClient),
      ]);
      throw error;
    }

    await reconcileNotificationState(
      collection,
      notificationStats,
      queryClient
    );
  };

interface DataCollections {
  battleChallenges: ReturnType<typeof makeBattleChallengesCollection>;
  battles: ReturnType<typeof makeBattlesCollection>;
  communities: ReturnType<typeof makeCommunitiesCollection>;
  following: ReturnType<typeof makeFollowingCollection>;
  getCommunityBans: (
    communityId: string
  ) => ReturnType<typeof makeCommunityBansCollection>;
  getCommunityMembers: (
    communityId: string
  ) => ReturnType<typeof makeCommunityMembersCollection>;
  getCommunityMessages: (
    communityId: string
  ) => ReturnType<typeof makeCommunityMessagesCollection>;
  getCommunityPosts: (
    communityId: string
  ) => ReturnType<typeof makeCommunityPostsCollection>;
  getComments: (
    videoId: string
  ) => ReturnType<typeof makeVideoCommentsCollection>;
  getNotifications: () => ReturnType<typeof makeNotificationCollection>;
  savedTrackIds: ReturnType<typeof makeSavedTrackIdsCollection>;
  notificationStats: ReturnType<typeof makeNotificationStatsCollection>;
  playlists: ReturnType<typeof makePlaylistsCollection>;
  getPlaylistTracks: (
    playlistId: string
  ) => ReturnType<typeof makePlaylistTracksCollection>;
  cleanup: () => void;
}

interface DataDbContextValue extends DataCollections {
  queryClient: QueryClient;
  scopeKey: string;
}

const DataDbContext = createContext<DataDbContextValue | null>(null),
  loadSubsetFromMeta = (meta: Record<string, unknown> | undefined) => {
    const options = meta?.loadSubsetOptions;
    if (!options || typeof options !== "object") {
      return { limit: 20, offset: 0 };
    }

    const subset = options as { limit?: number; offset?: number };
    return {
      limit: subset.limit ?? 20,
      offset: subset.offset ?? 0,
    };
  },
  makeNotificationCollection = (queryClient: QueryClient, scopeKey: string) => {
    const collection = createCollection(
      queryCollectionOptions({
        enabled: scopeKey !== "anonymous",
        getKey: (notification) => notification.id,
        id: `soundkit-db-notifications-${scopeKey}`,
        queryClient,
        queryFn: async ({ meta }) => {
          const { limit, offset } = loadSubsetFromMeta(meta),
            response = await rpcJson(
              await notificationsGet({
                query: {
                  limit,
                  offset,
                },
              })
            );
          return response.items;
        },
        queryKey: ["soundkit-db", scopeKey, "notifications"],
        schema: notificationSchema,
        syncMode: "on-demand",
      })
    );

    collection.createIndex((notification) => notification.createdAt, {
      indexType: BasicIndex,
      name: "notifications-created-at",
    });
    return collection;
  },
  makeNotificationStatsCollection = (
    queryClient: QueryClient,
    scopeKey: string
  ) =>
    createCollection(
      queryCollectionOptions({
        enabled: scopeKey !== "anonymous",
        getKey: (summary) => summary.id,
        id: `soundkit-db-notification-stats-${scopeKey}`,
        queryClient,
        queryFn: async () => {
          const response = await fetch(`${API_V1_URL}/notifications/summary`, {
            credentials: "include",
          });
          if (!response.ok) {
            throw new Error(
              `Unable to load notification summary: ${response.status}`
            );
          }
          const summary = (await response.json()) as { unreadCount: number };
          return [{ id: "summary" as const, unreadCount: summary.unreadCount }];
        },
        queryKey: ["soundkit-db", scopeKey, "notification-stats"],
        schema: notificationStatsSchema,
      })
    ),
  makeVideoCommentsCollection = (
    queryClient: QueryClient,
    scopeKey: string,
    videoId: string
  ) =>
    createCollection(
      queryCollectionOptions({
        enabled: videoId.length > 0,
        getKey: (comment) => comment.id,
        id: `soundkit-db-video-comments-${scopeKey}-${videoId}`,
        onInsert: async ({ transaction, collection }) => {
          for (const mutation of transaction.mutations) {
            const comment = mutation.modified,
              created = await rpcJson(
                await videoCommentsPost({
                  json: {
                    body: comment.body,
                    clientCommentId: comment.id,
                    parentCommentId: comment.parentCommentId,
                  },
                  param: { videoId },
                })
              );
            collection.utils.writeUpsert({
              ...created,
              authorAvatarUrl: created.authorAvatarUrl ?? null,
              authorName: created.authorName ?? null,
              authorUsername: created.authorUsername ?? null,
              parentCommentId: created.parentCommentId ?? null,
            });
          }
          await collection.utils.refetch();
          return { refetch: false };
        },
        queryClient,
        queryFn: async () => {
          const comments = await rpcJson(
            await videoCommentsGet({ param: { videoId } })
          );
          return comments.map((comment) => ({
            ...comment,
            authorAvatarUrl: comment.authorAvatarUrl ?? null,
            authorName: comment.authorName ?? null,
            authorUsername: comment.authorUsername ?? null,
            parentCommentId: comment.parentCommentId ?? null,
          }));
        },
        queryKey: ["soundkit-db", scopeKey, "video-comments", videoId],
        schema: videoCommentSchema,
      })
    ),
  makeSavedTrackIdsCollection = (queryClient: QueryClient, scopeKey: string) =>
    createCollection(
      queryCollectionOptions({
        enabled: scopeKey !== "anonymous",
        getKey: (track) => track.id,
        id: `soundkit-db-saved-track-ids-${scopeKey}`,
        queryClient,
        queryFn: async () => {
          const tracks = await rpcJson(await librarySavedGet());
          return tracks.map(({ id }) => ({ id }));
        },
        queryKey: ["soundkit-db", scopeKey, "saved-track-ids"],
        schema: savedTrackIdSchema,
      })
    ),
  makePlaylistsCollection = (queryClient: QueryClient, scopeKey: string) =>
    createCollection(
      queryCollectionOptions({
        enabled: scopeKey !== "anonymous",
        getKey: (playlist) => playlist.id,
        id: `soundkit-db-playlists-${scopeKey}`,
        queryClient,
        queryFn: async () => rpcJson(await libraryPlaylistsGet()),
        queryKey: ["soundkit-db", scopeKey, "playlists"],
        schema: playlistSchema,
      })
    ),
  makePlaylistTracksCollection = (
    queryClient: QueryClient,
    scopeKey: string,
    playlistId: string
  ) =>
    createCollection(
      queryCollectionOptions({
        enabled: playlistId.length > 0,
        getKey: (track) => track.id,
        id: `soundkit-db-playlist-tracks-${scopeKey}-${playlistId}`,
        queryClient,
        queryFn: async () => {
          const response = await rpcJson(
            await libraryPlaylistGet({ param: { id: playlistId } })
          );
          return response.tracks;
        },
        queryKey: ["soundkit-db", scopeKey, "playlist-tracks", playlistId],
        schema: playlistTrackSchema,
      })
    ),
  makeCommunitiesCollection = (queryClient: QueryClient, scopeKey: string) =>
    createCollection(
      queryCollectionOptions({
        getKey: (community) => community.id,
        id: `soundkit-db-communities-${scopeKey}`,
        queryClient,
        queryFn: async () =>
          rpcJson(
            await communitiesGet({
              query: {
                access: "all",
                genre: "all",
                q: "",
                sort: "activity-desc",
              },
            })
          ),
        queryKey: ["soundkit-db", scopeKey, "communities"],
        schema: communitySchema,
      })
    ),
  makeCommunityPostsCollection = (
    queryClient: QueryClient,
    scopeKey: string,
    communityId: string
  ) =>
    createCollection(
      queryCollectionOptions({
        enabled: scopeKey !== "anonymous" && communityId.length > 0,
        getKey: (post) => post.id,
        id: `soundkit-db-community-posts-${scopeKey}-${communityId}`,
        queryClient,
        queryFn: async () =>
          rpcJson(await communityPostsGet({ param: { communityId } })),
        queryKey: ["soundkit-db", scopeKey, "community-posts", communityId],
        refetchInterval: 5000,
        schema: communityPostSchema,
      })
    ),
  makeCommunityMessagesCollection = (
    queryClient: QueryClient,
    scopeKey: string,
    communityId: string
  ) =>
    createCollection(
      queryCollectionOptions({
        enabled: scopeKey !== "anonymous" && communityId.length > 0,
        getKey: (message) => message.id,
        id: `soundkit-db-community-messages-${scopeKey}-${communityId}`,
        queryClient,
        queryFn: async () =>
          rpcJson(await communityMessagesGet({ param: { communityId } })),
        queryKey: ["soundkit-db", scopeKey, "community-messages", communityId],
        refetchInterval: 3000,
        schema: communityMessageSchema,
      })
    ),
  makeCommunityMembersCollection = (
    queryClient: QueryClient,
    scopeKey: string,
    communityId: string
  ) =>
    createCollection(
      queryCollectionOptions({
        enabled: scopeKey !== "anonymous" && communityId.length > 0,
        getKey: (member) => member.userId,
        id: `soundkit-db-community-members-${scopeKey}-${communityId}`,
        queryClient,
        queryFn: async () =>
          rpcJson(await communityMembersGet({ param: { communityId } })),
        queryKey: ["soundkit-db", scopeKey, "community-members", communityId],
        refetchInterval: 10_000,
        schema: communityMemberSchema,
      })
    ),
  makeCommunityBansCollection = (
    queryClient: QueryClient,
    scopeKey: string,
    communityId: string
  ) =>
    createCollection(
      queryCollectionOptions({
        enabled: scopeKey !== "anonymous" && communityId.length > 0,
        getKey: (ban) => ban.userId,
        id: `soundkit-db-community-bans-${scopeKey}-${communityId}`,
        queryClient,
        queryFn: async () =>
          rpcJson(await communityBansGet({ param: { communityId } })),
        queryKey: ["soundkit-db", scopeKey, "community-bans", communityId],
        schema: communityBanSchema,
      })
    ),
  makeFollowingCollection = (queryClient: QueryClient, scopeKey: string) =>
    createCollection(
      queryCollectionOptions({
        enabled: scopeKey !== "anonymous",
        getKey: (person) => person.id,
        id: `soundkit-db-following-${scopeKey}`,
        queryClient,
        queryFn: async () => {
          const response = await rpcJson(
            await apiClient.v1.network.index.$get()
          );
          return response.following;
        },
        queryKey: ["soundkit-db", scopeKey, "following"],
        schema: followingSchema,
      })
    ),
  makeBattleChallengesCollection = (
    queryClient: QueryClient,
    scopeKey: string
  ) =>
    createCollection(
      queryCollectionOptions({
        enabled: scopeKey !== "anonymous",
        getKey: (challenge) => challenge.id,
        id: `soundkit-db-battle-challenges-${scopeKey}`,
        queryClient,
        queryFn: async () => {
          const response = await rpcJson(await battleChallengesGet());
          return [...response.incoming, ...response.outgoing];
        },
        queryKey: ["soundkit-db", scopeKey, "battle-challenges"],
        refetchInterval: 10_000,
        schema: battleChallengeSchema,
      })
    ),
  makeBattlesCollection = (queryClient: QueryClient, scopeKey: string) =>
    createCollection(
      queryCollectionOptions({
        enabled: scopeKey !== "anonymous",
        getKey: (battle) => battle.id,
        id: `soundkit-db-battles-${scopeKey}`,
        queryClient,
        queryFn: async () => rpcJson(await battlesGet({ query: {} })),
        queryKey: ["soundkit-db", scopeKey, "battles"],
        refetchInterval: 10_000,
        schema: battleSummarySchema,
      })
    ),
  createCollections = (
    queryClient: QueryClient,
    scopeKey: string
  ): DataCollections => {
    const comments = new Map<
        string,
        ReturnType<typeof makeVideoCommentsCollection>
      >(),
      communityPosts = new Map<
        string,
        ReturnType<typeof makeCommunityPostsCollection>
      >(),
      communityMessages = new Map<
        string,
        ReturnType<typeof makeCommunityMessagesCollection>
      >(),
      communityMembers = new Map<
        string,
        ReturnType<typeof makeCommunityMembersCollection>
      >(),
      communityBans = new Map<
        string,
        ReturnType<typeof makeCommunityBansCollection>
      >(),
      battleChallenges = makeBattleChallengesCollection(queryClient, scopeKey),
      battles = makeBattlesCollection(queryClient, scopeKey),
      playlistTracks = new Map<
        string,
        ReturnType<typeof makePlaylistTracksCollection>
      >(),
      communities = makeCommunitiesCollection(queryClient, scopeKey),
      notifications = makeNotificationCollection(queryClient, scopeKey),
      notificationStats = makeNotificationStatsCollection(
        queryClient,
        scopeKey
      ),
      playlists = makePlaylistsCollection(queryClient, scopeKey),
      following = makeFollowingCollection(queryClient, scopeKey),
      savedTrackIds = makeSavedTrackIdsCollection(queryClient, scopeKey),
      getComments = (videoId: string) => {
        const existing = comments.get(videoId);
        if (existing) {
          return existing;
        }
        const collection = makeVideoCommentsCollection(
          queryClient,
          scopeKey,
          videoId
        );
        comments.set(videoId, collection);
        return collection;
      },
      getCommunityPosts = (communityId: string) => {
        const existing = communityPosts.get(communityId);
        if (existing) {
          return existing;
        }
        const collection = makeCommunityPostsCollection(
          queryClient,
          scopeKey,
          communityId
        );
        communityPosts.set(communityId, collection);
        return collection;
      },
      getCommunityMessages = (communityId: string) => {
        const existing = communityMessages.get(communityId);
        if (existing) {
          return existing;
        }
        const collection = makeCommunityMessagesCollection(
          queryClient,
          scopeKey,
          communityId
        );
        communityMessages.set(communityId, collection);
        return collection;
      },
      getCommunityMembers = (communityId: string) => {
        const existing = communityMembers.get(communityId);
        if (existing) {
          return existing;
        }
        const collection = makeCommunityMembersCollection(
          queryClient,
          scopeKey,
          communityId
        );
        communityMembers.set(communityId, collection);
        return collection;
      },
      getCommunityBans = (communityId: string) => {
        const existing = communityBans.get(communityId);
        if (existing) {
          return existing;
        }
        const collection = makeCommunityBansCollection(
          queryClient,
          scopeKey,
          communityId
        );
        communityBans.set(communityId, collection);
        return collection;
      },
      getPlaylistTracks = (playlistId: string) => {
        const existing = playlistTracks.get(playlistId);
        if (existing) {
          return existing;
        }
        const collection = makePlaylistTracksCollection(
          queryClient,
          scopeKey,
          playlistId
        );
        playlistTracks.set(playlistId, collection);
        return collection;
      },
      cleanup = () => {
        battleChallenges.cleanup();
        battles.cleanup();
        communities.cleanup();
        notifications.cleanup();
        notificationStats.cleanup();
        following.cleanup();
        playlists.cleanup();
        savedTrackIds.cleanup();
        for (const collection of comments.values()) {
          collection.cleanup();
        }
        for (const collection of playlistTracks.values()) {
          collection.cleanup();
        }
        for (const collectionMap of [
          communityPosts,
          communityMessages,
          communityMembers,
          communityBans,
        ]) {
          for (const collection of collectionMap.values()) {
            collection.cleanup();
          }
        }
      };

    return {
      battleChallenges,
      battles,
      cleanup,
      communities,
      following,
      getComments,
      getCommunityBans,
      getCommunityMembers,
      getCommunityMessages,
      getCommunityPosts,
      getNotifications: () => notifications,
      getPlaylistTracks,
      notificationStats,
      playlists,
      savedTrackIds,
    };
  };

export function DataDbProvider({
  children,
  queryClient,
  scopeKey = "anonymous",
}: {
  children: ReactNode;
  queryClient: QueryClient;
  scopeKey?: string;
}) {
  const [collections] = useState(() =>
      createCollections(queryClient, scopeKey)
    ),
    cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null),
    value = useMemo(
      () => ({ ...collections, queryClient, scopeKey }),
      [collections, queryClient, scopeKey]
    );

  useEffect(() => {
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    return () => {
      cleanupTimerRef.current = setTimeout(() => {
        collections.cleanup();
        cleanupTimerRef.current = null;
      }, 0);
    };
  }, [collections]);

  return (
    <DataDbContext.Provider value={value}>{children}</DataDbContext.Provider>
  );
}

const useDataDb = () => {
  const context = useContext(DataDbContext);
  if (!context) {
    throw new Error("DataDbProvider is required for data collections");
  }
  return context;
};

export const useDbBattleChallenges = () => {
  const collection = useDataDb().battleChallenges,
    result = useLiveQuery(collection);
  return { ...result, collection, data: result.data ?? [] };
};

export const useDbBattles = () => {
  const collection = useDataDb().battles,
    result = useLiveQuery(collection);
  return { ...result, collection, data: result.data ?? [] };
};

export const useDbBattleActions = () => {
  const { battleChallenges, battles, queryClient } = useDataDb(),
    createChallenge = useMemo(
      () =>
        createOptimisticAction<{
          body: CreateBattleChallengeBody;
          optimistic: DbBattleChallenge;
        }>({
          mutationFn: async ({ body }) => {
            await rpcJson(await battleChallengePost({ json: body }));
            await Promise.all([
              battleChallenges.utils.refetch(),
              queryClient.invalidateQueries({
                queryKey: soundkitQueryKeys.battles,
              }),
            ]);
          },
          onMutate: ({ optimistic }) => {
            battleChallenges.insert(optimistic);
          },
        }),
      [battleChallenges, queryClient]
    ),
    updateChallenge = useMemo(
      () =>
        createOptimisticAction<{
          challengeId: string;
          status: "accepted" | "canceled" | "declined";
        }>({
          mutationFn: async ({ challengeId, status }) => {
            await rpcJson(
              await battleChallengePatch({
                json: { status },
                param: { challengeId },
              })
            );
            await Promise.all([
              battleChallenges.utils.refetch(),
              battles.utils.refetch(),
              queryClient.invalidateQueries({
                queryKey: soundkitQueryKeys.battles,
              }),
            ]);
          },
          onMutate: ({ challengeId, status }) => {
            battleChallenges.update(challengeId, (draft) => {
              draft.status = status;
            });
          },
        }),
      [battleChallenges, battles, queryClient]
    ),
    clearChallenge = useMemo(
      () =>
        createOptimisticAction<string>({
          mutationFn: async (challengeId) => {
            await rpcJson(
              await battleChallengeDelete({ param: { challengeId } })
            );
            await Promise.all([
              battleChallenges.utils.refetch(),
              queryClient.invalidateQueries({
                queryKey: soundkitQueryKeys.battles,
              }),
            ]);
          },
          onMutate: (challengeId) => {
            battleChallenges.delete(challengeId);
          },
        }),
      [battleChallenges, queryClient]
    ),
    deleteBattle = useMemo(
      () =>
        createOptimisticAction<string>({
          mutationFn: async (battleId) => {
            await rpcJson(await battleDelete({ param: { battleId } }));
            await Promise.all([
              battles.utils.refetch(),
              battleChallenges.utils.refetch(),
              queryClient.invalidateQueries({
                queryKey: soundkitQueryKeys.battles,
              }),
            ]);
          },
          onMutate: (battleId) => {
            battles.delete(battleId);
          },
        }),
      [battleChallenges, battles, queryClient]
    );

  return { clearChallenge, createChallenge, deleteBattle, updateChallenge };
};

export const useDbNotifications = () => {
  const collection = useDataDb().getNotifications();
  return useLiveInfiniteQuery(
    (q) =>
      q
        .from({ notification: collection })
        .orderBy(({ notification }) => notification.createdAt, "desc")
        .orderBy(({ notification }) => notification.id, "desc"),
    { pageSize: 20 }
  );
};

export const useDbNotificationActions = () => {
  const { getNotifications, notificationStats, queryClient } = useDataDb(),
    collection = getNotifications(),
    markRead = useMemo(
      () =>
        createOptimisticAction<string>({
          mutationFn: async (notificationId) => {
            await runNotificationMutation({
              collection,
              notificationStats,
              queryClient,
              request: async () =>
                rpcJson(
                  await notificationReadPost({
                    param: { notificationId },
                  })
                ),
            });
          },
          onMutate: (notificationId) => {
            const notification = collection.toArray.find(
              (item) => item.id === notificationId
            );
            if (!notification || notification.read) {
              return;
            }
            collection.update(notificationId, (draft) => {
              draft.read = true;
            });
            if (notificationStats.toArray.length > 0) {
              notificationStats.update("summary", (draft) => {
                draft.unreadCount = Math.max(0, draft.unreadCount - 1);
              });
            }
          },
        }),
      [collection, notificationStats, queryClient]
    ),
    markAllRead = useMemo(
      () =>
        createOptimisticAction<void>({
          mutationFn: async () => {
            await runNotificationMutation({
              collection,
              notificationStats,
              queryClient,
              request: async () => rpcJson(await notificationsReadAllPost()),
            });
          },
          onMutate: () => {
            for (const notification of collection.toArray) {
              if (!notification.read) {
                collection.update(notification.id, (draft) => {
                  draft.read = true;
                });
              }
            }
            if (notificationStats.toArray.length > 0) {
              notificationStats.update("summary", (draft) => {
                draft.unreadCount = 0;
              });
            }
          },
        }),
      [collection, notificationStats, queryClient]
    ),
    clearAll = useMemo(
      () =>
        createOptimisticAction<void>({
          mutationFn: async () => {
            await runNotificationMutation({
              collection,
              notificationStats,
              queryClient,
              request: async () => rpcJson(await notificationsClearPost()),
            });
          },
          onMutate: () => {
            const notificationIds = collection.toArray.map(
              (notification) => notification.id
            );
            if (notificationIds.length > 0) {
              collection.delete(notificationIds);
            }
            if (notificationStats.toArray.length > 0) {
              notificationStats.update("summary", (draft) => {
                draft.unreadCount = 0;
              });
            }
          },
        }),
      [collection, notificationStats, queryClient]
    );

  return { clearAll, markAllRead, markRead };
};

export const useDbNotificationUnreadCount = () => {
  const collection = useDataDb().notificationStats,
    result = useLiveQuery(collection);
  return result.data?.[0]?.unreadCount ?? 0;
};

export const useDbVideoComments = (videoId: string) => {
  const { getComments } = useDataDb(),
    collection = useMemo(() => getComments(videoId), [getComments, videoId]),
    result = useLiveQuery((q) =>
      q
        .from({ comment: collection })
        .orderBy(({ comment }) => comment.createdAt, "asc")
        .orderBy(({ comment }) => comment.id, "asc")
    );
  return { ...result, collection, data: result.data ?? [] };
};

export const useCreateDbVideoComment = (
  videoId: string,
  author: {
    avatarUrl?: string | null;
    id: string;
    name?: string | null;
    username?: string | null;
  }
) => {
  const { getComments } = useDataDb(),
    collection = useMemo(() => getComments(videoId), [getComments, videoId]),
    [isPending, setIsPending] = useState(false),
    mutate = useCallback(
      (
        body: string,
        options?: {
          onError?: (error: unknown) => void;
          parentCommentId?: string | null;
        }
      ) => {
        const id = crypto.randomUUID(),
          optimisticComment: DbVideoComment = {
            authorAvatarUrl: author.avatarUrl ?? null,
            authorName: author.name ?? "You",
            authorUsername: author.username ?? null,
            body,
            createdAt: new Date().toISOString(),
            id,
            parentCommentId: options?.parentCommentId ?? null,
            userId: author.id,
          };
        setIsPending(true);
        try {
          const transaction = collection.insert(optimisticComment);
          void transaction.isPersisted.promise.then(
            () => setIsPending(false),
            () => setIsPending(false)
          );
          return transaction;
        } catch (error) {
          setIsPending(false);
          options?.onError?.(error);
          return null;
        }
      },
      [author.avatarUrl, author.id, author.name, author.username, collection]
    );
  return { isPending, mutate };
};

export const useDbPlaylists = () => {
  const collection = useDataDb().playlists,
    result = useLiveQuery((q) =>
      q
        .from({ playlist: collection })
        .orderBy(({ playlist }) => playlist.title, "asc")
        .orderBy(({ playlist }) => playlist.id, "asc")
    );
  return { ...result, collection, data: result.data ?? [] };
};

export const useDbPlaylistActions = () => {
  const { playlists: collection, queryClient } = useDataDb(),
    create = useMemo(
      () =>
        createOptimisticAction<{
          description?: string;
          id: string;
          title: string;
        }>({
          mutationFn: async ({ description, id, title }) => {
            await rpcJson(
              await libraryPlaylistsPost({
                json: { clientPlaylistId: id, description, title },
              })
            );
            await Promise.all([
              collection.utils.refetch(),
              queryClient.invalidateQueries({
                queryKey: soundkitQueryKeys.libraryPlaylists,
              }),
              queryClient.invalidateQueries({
                queryKey: soundkitQueryKeys.libraryOverview,
              }),
            ]);
          },
          onMutate: ({ description, id, title }) => {
            collection.insert({
              description: description ?? null,
              id,
              isPublic: false,
              title,
              trackCount: 0,
            });
          },
        }),
      [collection, queryClient]
    ),
    deletePlaylist = useMemo(
      () =>
        createOptimisticAction<string>({
          mutationFn: async (id) => {
            await rpcJson(await libraryPlaylistDelete({ param: { id } }));
            await Promise.all([
              collection.utils.refetch(),
              queryClient.invalidateQueries({
                queryKey: soundkitQueryKeys.libraryPlaylists,
              }),
              queryClient.invalidateQueries({
                queryKey: soundkitQueryKeys.libraryOverview,
              }),
            ]);
          },
          onMutate: (id) => {
            collection.delete(id);
          },
        }),
      [collection, queryClient]
    );

  return {
    create: (input: { description?: string; title: string }) => {
      const id = crypto.randomUUID();
      return { id, transaction: create({ ...input, id }) };
    },
    deletePlaylist,
  };
};

export const useDbPlaylistTracks = (playlistId: string) => {
  const { getPlaylistTracks } = useDataDb(),
    collection = useMemo(
      () => getPlaylistTracks(playlistId),
      [getPlaylistTracks, playlistId]
    ),
    result = useLiveQuery((q) =>
      q
        .from({ track: collection })
        .orderBy(({ track }) => track.title, "asc")
        .orderBy(({ track }) => track.id, "asc")
    );
  return { ...result, collection, data: result.data ?? [] };
};

export const useDbPlaylistTrackActions = (playlistId: string) => {
  const { getPlaylistTracks, queryClient } = useDataDb(),
    collection = useMemo(
      () => getPlaylistTracks(playlistId),
      [getPlaylistTracks, playlistId]
    ),
    add = useMemo(
      () =>
        createOptimisticAction<{
          artist: string;
          artistSlug: string;
          cover: string;
          duration: string;
          genre: string | null;
          id: string;
          regionSlug: string | null;
          slug: string | null;
          title: string;
        }>({
          mutationFn: async ({ id }) => {
            await rpcJson(
              await libraryPlaylistTracksPost({
                json: { trackId: id },
                param: { id: playlistId },
              })
            );
            await Promise.all([
              collection.utils.refetch(),
              queryClient.invalidateQueries({
                queryKey: soundkitQueryKeys.libraryPlaylist(playlistId),
              }),
              queryClient.invalidateQueries({
                queryKey: soundkitQueryKeys.libraryPlaylists,
              }),
            ]);
          },
          onMutate: (track) => {
            if (!collection.toArray.some((item) => item.id === track.id)) {
              collection.insert(track);
            }
          },
        }),
      [collection, playlistId, queryClient]
    ),
    remove = useMemo(
      () =>
        createOptimisticAction<string>({
          mutationFn: async (trackId) => {
            await rpcJson(
              await libraryPlaylistTrackDelete({
                param: { id: playlistId, trackId },
              })
            );
            await Promise.all([
              collection.utils.refetch(),
              queryClient.invalidateQueries({
                queryKey: soundkitQueryKeys.libraryPlaylist(playlistId),
              }),
              queryClient.invalidateQueries({
                queryKey: soundkitQueryKeys.libraryPlaylists,
              }),
            ]);
          },
          onMutate: (trackId) => {
            collection.delete(trackId);
          },
        }),
      [collection, playlistId, queryClient]
    );

  return { add, remove };
};

export const useDbSavedTrackIds = () => {
  const collection = useDataDb().savedTrackIds,
    result = useLiveQuery(collection);
  return { ...result, data: result.data ?? [] };
};

export const useDbSavedTrackActions = () => {
  const { queryClient, savedTrackIds: collection } = useDataDb(),
    remove = useMemo(
      () =>
        createOptimisticAction<string>({
          mutationFn: async (trackId) => {
            await rpcJson(await librarySaveTrackDelete({ param: { trackId } }));
            await Promise.all([
              collection.utils.refetch(),
              queryClient.invalidateQueries({
                queryKey: ["library", "saved"],
              }),
              queryClient.invalidateQueries({
                queryKey: ["library", "overview"],
              }),
            ]);
          },
          onMutate: (trackId) => {
            collection.delete(trackId);
          },
        }),
      [collection, queryClient]
    ),
    toggle = useMemo(
      () =>
        createOptimisticAction<string>({
          mutationFn: async (trackId) => {
            await rpcJson(await librarySaveTrackPost({ param: { trackId } }));
            await Promise.all([
              collection.utils.refetch(),
              queryClient.invalidateQueries({
                queryKey: ["library", "saved"],
              }),
              queryClient.invalidateQueries({
                queryKey: ["library", "overview"],
              }),
            ]);
          },
          onMutate: (trackId) => {
            const existing = collection.toArray.some(
              (track) => track.id === trackId
            );
            if (existing) {
              collection.delete(trackId);
            } else {
              collection.insert({ id: trackId });
            }
          },
        }),
      [collection, queryClient]
    );
  return { remove, toggle };
};

export const useDbFollowing = () => {
  const collection = useDataDb().following,
    result = useLiveQuery(collection);
  return { ...result, collection, data: result.data ?? [] };
};

const requestProfileFollow = async (
  username: string,
  method: "DELETE" | "POST"
) => {
  const response = await fetch(
    `${API_V1_URL}/social/profiles/${encodeURIComponent(username)}/follow`,
    { credentials: "include", method }
  );
  if (!response.ok) {
    throw new Error("Unable to update profile follow state.");
  }
};

export const useDbFollowActions = () => {
  const { following: collection, queryClient } = useDataDb(),
    follow = useMemo(
      () =>
        createOptimisticAction<{
          accountType: "artist" | "fan";
          id: string;
          name: string;
          username: string;
        }>({
          mutationFn: async ({ accountType, username }) => {
            if (accountType === "artist") {
              await rpcJson(await artistFollowPost({ param: { username } }));
            } else {
              await requestProfileFollow(username, "POST");
            }
            await Promise.all([
              collection.utils.refetch(),
              queryClient.invalidateQueries({
                queryKey: ["artists", username],
              }),
              queryClient.invalidateQueries({
                queryKey: ["public-profile", username],
              }),
              queryClient.invalidateQueries({ queryKey: ["network"] }),
            ]);
          },
          onMutate: ({ accountType, id, name, username }) => {
            const existing = collection.toArray.find(
              (person) => person.id === id
            );
            if (existing) {
              collection.update(id, (draft) => {
                draft.isFollowing = true;
              });
              return;
            }
            collection.insert({
              accountType,
              avatarUrl: null,
              canMessage: false,
              email: null,
              followsYou: false,
              id,
              isFollowing: true,
              isFriend: false,
              name,
              username,
            });
          },
        }),
      [collection, queryClient]
    ),
    unfollow = useMemo(
      () =>
        createOptimisticAction<{
          accountType: "artist" | "fan";
          id: string;
          username: string;
        }>({
          mutationFn: async ({ accountType, username }) => {
            if (accountType === "artist") {
              await rpcJson(await artistFollowDelete({ param: { username } }));
            } else {
              await requestProfileFollow(username, "DELETE");
            }
            await Promise.all([
              collection.utils.refetch(),
              queryClient.invalidateQueries({
                queryKey: ["artists", username],
              }),
              queryClient.invalidateQueries({
                queryKey: ["public-profile", username],
              }),
              queryClient.invalidateQueries({ queryKey: ["network"] }),
            ]);
          },
          onMutate: ({ id }) => {
            collection.delete(id);
          },
        }),
      [collection, queryClient]
    );
  return { follow, unfollow };
};

export const useDbCommunities = () => {
  const collection = useDataDb().communities,
    result = useLiveQuery((q) =>
      q
        .from({ community: collection })
        .orderBy(({ community }) => community.updatedAt, "desc")
        .orderBy(({ community }) => community.id, "asc")
    );
  return { ...result, collection, data: result.data ?? [] };
};

export const useDbCommunity = (communityId: string) => {
  const result = useDbCommunities();
  return {
    ...result,
    community:
      result.data.find((community) => community.id === communityId) ?? null,
  };
};

export const useDbCommunityActions = () => {
  const { communities: collection } = useDataDb(),
    create = useCallback(
      async (input: {
        coverImageUrl?: string | null;
        description?: string;
        genreId?: string | null;
        monthlyPriceCents: number;
        name: string;
      }) => {
        const created = await rpcJson(await communityPost({ json: input }));
        collection.utils.writeUpsert(created);
        return created;
      },
      [collection]
    ),
    joinFree = useMemo(
      () =>
        createOptimisticAction<string>({
          mutationFn: async (communityId) => {
            await rpcJson(await communityJoinPost({ param: { communityId } }));
            await collection.utils.refetch();
          },
          onMutate: (communityId) => {
            collection.update(communityId, (draft) => {
              if (!draft.isMember) {
                draft.isMember = true;
                draft.memberCount += 1;
              }
            });
          },
        }),
      [collection]
    ),
    update = useMemo(
      () =>
        createOptimisticAction<{
          communityId: string;
          coverImageUrl?: string | null;
          description?: string;
          genreId?: string | null;
          monthlyPriceCents?: number;
          name?: string;
        }>({
          mutationFn: async ({ communityId, ...json }) => {
            await rpcJson(
              await communityPatch({ json, param: { communityId } })
            );
            await collection.utils.refetch();
          },
          onMutate: ({ communityId, ...changes }) => {
            collection.update(communityId, (draft) => {
              Object.assign(draft, changes);
              draft.updatedAt = new Date().toISOString();
            });
          },
        }),
      [collection]
    );
  return { create, joinFree, update };
};

export const useDbCommunityPosts = (communityId: string) => {
  const { getCommunityPosts } = useDataDb(),
    collection = useMemo(
      () => getCommunityPosts(communityId),
      [communityId, getCommunityPosts]
    ),
    result = useLiveQuery((q) =>
      q
        .from({ post: collection })
        .orderBy(({ post }) => post.isPinned, "desc")
        .orderBy(({ post }) => post.createdAt, "desc")
    );
  return { ...result, collection, data: result.data ?? [] };
};

export const useCreateDbCommunityPost = (
  communityId: string,
  author: {
    avatarUrl?: string | null;
    id: string;
    name: string;
    username: string;
  }
) => {
  const { getCommunityPosts } = useDataDb(),
    collection = useMemo(
      () => getCommunityPosts(communityId),
      [communityId, getCommunityPosts]
    ),
    create = useMemo(
      () =>
        createOptimisticAction<{
          body: string;
          id: string;
          postType: "text" | "image" | "audio" | "video" | "poll";
        }>({
          mutationFn: async ({ body, postType }) => {
            await rpcJson(
              await communityPostsPost({
                json: { body, postType },
                param: { communityId },
              })
            );
            await collection.utils.refetch();
          },
          onMutate: ({ body, id, postType }) => {
            collection.insert({
              author: {
                avatarUrl: author.avatarUrl ?? null,
                name: author.name,
                username: author.username,
              },
              body,
              createdAt: new Date().toISOString(),
              id,
              isPinned: false,
              mediaUrl: null,
              metadata: null,
              postType,
              userId: author.id,
            });
          },
        }),
      [
        author.avatarUrl,
        author.id,
        author.name,
        author.username,
        collection,
        communityId,
      ]
    );
  return (body: string) =>
    create({ body, id: crypto.randomUUID(), postType: "text" });
};

const communityMessageQueues = new Map<string, Promise<void>>();

export const useDbCommunityMessages = (communityId: string) => {
  const { getCommunityMessages } = useDataDb(),
    collection = useMemo(
      () => getCommunityMessages(communityId),
      [communityId, getCommunityMessages]
    ),
    result = useLiveQuery((q) =>
      q
        .from({ message: collection })
        .orderBy(({ message }) => message.createdAt, "asc")
        .orderBy(({ message }) => message.id, "asc")
    );
  return { ...result, collection, data: result.data ?? [] };
};

export const useSendDbCommunityMessage = (
  communityId: string,
  author: {
    avatarUrl?: string | null;
    id: string;
    name: string;
    username: string;
  }
) => {
  const { getCommunityMessages } = useDataDb(),
    collection = useMemo(
      () => getCommunityMessages(communityId),
      [communityId, getCommunityMessages]
    ),
    send = useMemo(
      () =>
        createOptimisticAction<{ body: string; id: string }>({
          mutationFn: async ({ body, id }) => {
            const previous =
                communityMessageQueues.get(communityId) ?? Promise.resolve(),
              persistMessage = async () => {
                const createdMessage = await rpcJson(
                  await communityMessagesPost({
                    json: { body, clientMessageId: id },
                    param: { communityId },
                  })
                );
                collection.utils.writeUpsert(createdMessage);
              },
              queued = previous.then(persistMessage, persistMessage);
            communityMessageQueues.set(communityId, queued);
            const outcome = await queued.then(
              () => ({ error: null }),
              (error: unknown) => ({ error })
            );
            if (communityMessageQueues.get(communityId) === queued) {
              communityMessageQueues.delete(communityId);
            }
            if (outcome.error) {
              throw outcome.error;
            }
            await collection.utils.refetch();
          },
          onMutate: ({ body, id }) => {
            collection.insert({
              author: {
                avatarUrl: author.avatarUrl ?? null,
                name: author.name,
                username: author.username,
              },
              body,
              createdAt: new Date().toISOString(),
              id,
              userId: author.id,
            });
          },
        }),
      [
        author.avatarUrl,
        author.id,
        author.name,
        author.username,
        collection,
        communityId,
      ]
    );
  return (body: string) => send({ body, id: crypto.randomUUID() });
};

export const useDbCommunityMembers = (communityId: string) => {
  const { getCommunityMembers } = useDataDb(),
    collection = useMemo(
      () => getCommunityMembers(communityId),
      [communityId, getCommunityMembers]
    ),
    result = useLiveQuery((q) =>
      q
        .from({ member: collection })
        .orderBy(({ member }) => member.role, "asc")
        .orderBy(({ member }) => member.name, "asc")
    );
  return { ...result, collection, data: result.data ?? [] };
};

export const useDbCommunityBans = (communityId: string) => {
  const { getCommunityBans } = useDataDb(),
    collection = useMemo(
      () => getCommunityBans(communityId),
      [communityId, getCommunityBans]
    ),
    result = useLiveQuery((q) =>
      q.from({ ban: collection }).orderBy(({ ban }) => ban.bannedAt, "desc")
    );
  return { ...result, collection, data: result.data ?? [] };
};

export const useDbCommunityModeration = (communityId: string) => {
  const { communities, getCommunityBans, getCommunityMembers } = useDataDb(),
    members = useMemo(
      () => getCommunityMembers(communityId),
      [communityId, getCommunityMembers]
    ),
    bans = useMemo(
      () => getCommunityBans(communityId),
      [communityId, getCommunityBans]
    ),
    setRole = useMemo(
      () =>
        createOptimisticAction<{
          role: "moderator" | "member";
          userId: string;
        }>({
          mutationFn: async ({ role, userId }) => {
            await rpcJson(
              await communityMemberPatch({
                json: { role },
                param: { communityId, userId },
              })
            );
            await members.utils.refetch();
          },
          onMutate: ({ role, userId }) => {
            members.update(userId, (draft) => {
              draft.role = role;
            });
          },
        }),
      [communityId, members]
    ),
    remove = useMemo(
      () =>
        createOptimisticAction<string>({
          mutationFn: async (userId) => {
            await rpcJson(
              await communityMemberDelete({
                param: { communityId, userId },
              })
            );
            await Promise.all([
              members.utils.refetch(),
              communities.utils.refetch(),
            ]);
          },
          onMutate: (userId) => {
            members.delete(userId);
            communities.update(communityId, (draft) => {
              draft.memberCount = Math.max(0, draft.memberCount - 1);
            });
          },
        }),
      [communities, communityId, members]
    ),
    ban = useMemo(
      () =>
        createOptimisticAction<{
          member: DbCommunityMember;
          reason?: string;
        }>({
          mutationFn: async ({ member, reason }) => {
            await rpcJson(
              await communityMemberBanPost({
                json: { reason },
                param: { communityId, userId: member.userId },
              })
            );
            await Promise.all([
              members.utils.refetch(),
              bans.utils.refetch(),
              communities.utils.refetch(),
            ]);
          },
          onMutate: ({ member, reason }) => {
            members.delete(member.userId);
            bans.insert({
              avatarUrl: member.avatarUrl,
              bannedAt: new Date().toISOString(),
              name: member.name,
              reason: reason ?? null,
              userId: member.userId,
              username: member.username,
            });
            communities.update(communityId, (draft) => {
              draft.memberCount = Math.max(0, draft.memberCount - 1);
            });
          },
        }),
      [bans, communities, communityId, members]
    ),
    unban = useMemo(
      () =>
        createOptimisticAction<string>({
          mutationFn: async (userId) => {
            await rpcJson(
              await communityBanDelete({ param: { communityId, userId } })
            );
            await Promise.all([members.utils.refetch(), bans.utils.refetch()]);
          },
          onMutate: (userId) => {
            bans.delete(userId);
          },
        }),
      [bans, communityId, members]
    );
  return { ban, remove, setRole, unban };
};

export const savedTrackIdFromTrack = (track: LibrarySavedTrack) => track.id;
