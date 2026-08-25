import { queryCollectionOptions } from "@tanstack/query-db-collection";
import {
  createCollection,
  createOptimisticAction,
  eq,
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
  useState,
} from "react";
import type { ReactNode } from "react";
import { z } from "zod";

import { API_V1_URL, apiClient, rpcJson } from "./api";
import type { LibrarySavedTrack } from "./soundkit-api-hooks";

const notificationsGet = apiClient.v1.notifications.index.$get,
  notificationReadPost =
    apiClient.v1.notifications[":notificationId"].read.$post,
  notificationsReadAllPost = apiClient.v1.notifications["read-all"].$post,
  notificationsClearPost = apiClient.v1.notifications.clear.$post,
  videoCommentsGet = apiClient.v1.videos[":videoId"].comments.$get,
  videoCommentsPost = apiClient.v1.videos[":videoId"].comments.$post,
  librarySavedGet = apiClient.v1.library.saved.$get,
  librarySaveTrackPost = apiClient.v1.library.saved[":trackId"].$post,
  libraryPlaylistsGet = apiClient.v1.library.playlists.$get,
  libraryPlaylistsPost = apiClient.v1.library.playlists.$post,
  libraryPlaylistDelete = apiClient.v1.library.playlists[":id"].$delete,
  libraryPlaylistGet = apiClient.v1.library.playlists[":id"].$get,
  libraryPlaylistTracksPost = apiClient.v1.library.playlists[":id"].tracks.$post,
  libraryPlaylistTrackDelete =
    apiClient.v1.library.playlists[":id"].tracks[":trackId"].$delete,
  artistFollowPost = apiClient.v1.social.artists[":username"].follow.$post,
  artistFollowDelete = apiClient.v1.social.artists[":username"].follow.$delete,

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
    body: z.string(),
    createdAt: z.string(),
    id: z.string(),
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
  });

export type DbNotification = z.infer<typeof notificationSchema>;
export type DbVideoComment = z.infer<typeof videoCommentSchema>;
export type DbFollowing = z.infer<typeof followingSchema>;

const notificationStatsSchema = z.object({
  id: z.literal("summary"),
  unreadCount: z.number().int().nonnegative(),
});

interface DataCollections {
  following: ReturnType<typeof makeFollowingCollection>;
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

 makeNotificationCollection = (
  queryClient: QueryClient,
  scopeKey: string
) =>
  createCollection(
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
  ),

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
              },
              param: { videoId },
            })
          );
          collection.utils.writeUpsert({
            ...created,
            authorAvatarUrl: created.authorAvatarUrl ?? null,
            authorName: created.authorName ?? null,
          });
        }
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
        }));
      },
      queryKey: ["soundkit-db", scopeKey, "video-comments", videoId],
      schema: videoCommentSchema,
    })
  ),

 makeSavedTrackIdsCollection = (
  queryClient: QueryClient,
  scopeKey: string
) =>
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

 makeFollowingCollection = (queryClient: QueryClient, scopeKey: string) =>
  createCollection(
    queryCollectionOptions({
      enabled: scopeKey !== "anonymous",
      getKey: (person) => person.id,
      id: `soundkit-db-following-${scopeKey}`,
      queryClient,
      queryFn: async () => {
        const response = await rpcJson(await apiClient.v1.network.index.$get());
        return response.following;
      },
      queryKey: ["soundkit-db", scopeKey, "following"],
      schema: followingSchema,
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
    playlistTracks = new Map<
      string,
      ReturnType<typeof makePlaylistTracksCollection>
    >(),
    notifications = makeNotificationCollection(queryClient, scopeKey),
    notificationStats = makeNotificationStatsCollection(queryClient, scopeKey),
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
    };

  return {
    cleanup,
    following,
    getComments,
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
    value = useMemo(
      () => ({ ...collections, queryClient, scopeKey }),
      [collections, queryClient, scopeKey]
    );

  useEffect(() => () => collections.cleanup(), [collections]);

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
  const { getNotifications, notificationStats } = useDataDb(),
    collection = getNotifications(),

   markRead = useMemo(
    () =>
      createOptimisticAction<string>({
        mutationFn: async (notificationId) => {
          await rpcJson(
            await notificationReadPost({
              param: { notificationId },
            })
          );
        },
        onMutate: (notificationId) => {
          const notification = collection.toArray.find(
            (item) => item.id === notificationId
          );
          collection.update(notificationId, (draft) => {
            draft.read = true;
          });
          if (
            notification &&
            !notification.read &&
            notificationStats.toArray.length > 0
          ) {
            notificationStats.update("summary", (draft) => {
              draft.unreadCount = Math.max(0, draft.unreadCount - 1);
            });
          }
        },
      }),
    [collection, notificationStats]
  ),
   markAllRead = useMemo(
    () =>
      createOptimisticAction<void>({
        mutationFn: async () => {
          await rpcJson(await notificationsReadAllPost());
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
    [collection, notificationStats]
  ),
   clearAll = useMemo(
    () =>
      createOptimisticAction<void>({
        mutationFn: async () => {
          await rpcJson(await notificationsClearPost());
        },
        onMutate: () => {
          collection.delete(
            collection.toArray.map((notification) => notification.id)
          );
          if (notificationStats.toArray.length > 0) {
            notificationStats.update("summary", (draft) => {
              draft.unreadCount = 0;
            });
          }
        },
      }),
    [collection, notificationStats]
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
  author: { avatarUrl?: string | null; id: string; name?: string | null }
) => {
  const { getComments } = useDataDb(),
    collection = useMemo(() => getComments(videoId), [getComments, videoId]),
    [isPending, setIsPending] = useState(false),
    mutate = useCallback(
      (body: string, options?: { onError?: (error: unknown) => void }) => {
        const id = crypto.randomUUID(),
          optimisticComment: DbVideoComment = {
            authorAvatarUrl: author.avatarUrl ?? null,
            authorName: author.name ?? "You",
            body,
            createdAt: new Date().toISOString(),
            id,
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
      [author.avatarUrl, author.id, author.name, collection]
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
  const collection = useDataDb().playlists,
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
      [collection]
    ),
    deletePlaylist = useMemo(
      () =>
        createOptimisticAction<string>({
          mutationFn: async (id) => {
            await rpcJson(await libraryPlaylistDelete({ param: { id } }));
          },
          onMutate: (id) => {
            collection.delete(id);
          },
        }),
      [collection]
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
  const { getPlaylistTracks } = useDataDb(),
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
            await collection.utils.refetch();
          },
          onMutate: (track) => {
            if (!collection.toArray.some((item) => item.id === track.id)) {
              collection.insert(track);
            }
          },
        }),
      [collection, playlistId]
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
            await collection.utils.refetch();
          },
          onMutate: (trackId) => {
            collection.delete(trackId);
          },
        }),
      [collection, playlistId]
    );

  return { add, remove };
};

export const useDbSavedTrackIds = () => {
  const collection = useDataDb().savedTrackIds,
    result = useLiveQuery(collection);
  return { ...result, data: result.data ?? [] };
};

export const useDbSavedTrackActions = () => {
  const collection = useDataDb().savedTrackIds,
   toggle = useMemo(
    () =>
      createOptimisticAction<string>({
        mutationFn: async (trackId) => {
          await rpcJson(await librarySaveTrackPost({ param: { trackId } }));
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
    [collection]
  );
  return { toggle };
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
              queryClient.invalidateQueries({ queryKey: ["artists", username] }),
              queryClient.invalidateQueries({
                queryKey: ["public-profile", username],
              }),
              queryClient.invalidateQueries({ queryKey: ["network"] }),
            ]);
          },
          onMutate: ({ accountType, id, name, username }) => {
            const existing = collection.toArray.find((person) => person.id === id);
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
              queryClient.invalidateQueries({ queryKey: ["artists", username] }),
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

export const savedTrackIdFromTrack = (track: LibrarySavedTrack) => track.id;
