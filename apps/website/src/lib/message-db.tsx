import { queryCollectionOptions } from "@tanstack/query-db-collection";
/* eslint-disable one-var, sort-vars, prefer-destructuring, promise/prefer-await-to-then, promise/prefer-await-to-callbacks, react/hook-use-state */
import {
  createCollection,
  createOptimisticAction,
  useLiveQuery,
} from "@tanstack/react-db";
import { useMutation } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { apiClient, API_V1_URL, rpcJson } from "./api";
import type { LiveRoomChatMessage } from "./live-room";
import type { ConversationSummary, MessageSummary } from "./soundkit-api-hooks";

const conversationGet = apiClient.v1.messages.conversations.$get,
  conversationPost = apiClient.v1.messages.conversations.$post,
  conversationMessagesGet =
    apiClient.v1.messages.conversations[":conversationId"].messages.$get,
  conversationMessagesPost =
    apiClient.v1.messages.conversations[":conversationId"].messages.$post,
  conversationReadPost =
    apiClient.v1.messages.conversations[":conversationId"].read.$post;

const MESSAGE_SYNC_INTERVAL_MS = 15_000,
  NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

interface MessageAttachmentInput {
  displayName: string;
  mimeType?: string;
  objectKey?: string;
  sizeBytes?: number;
  sourceProjectId?: string;
  sourceTrackId?: string;
  url: string;
}

export interface CreateMessageCollectionInput {
  attachments: MessageAttachmentInput[];
  body: string;
}

export interface MessageCollectionMutationOptions {
  onError?: (error: unknown) => void;
  onSuccess?: (message: MessageSummary) => void;
}

const makeConversationCollection = (
    queryClient: QueryClient,
    scopeKey: string
  ) =>
    createCollection(
      queryCollectionOptions<ConversationSummary>({
        getKey: (conversation) => conversation.id,
        id: `soundkit-conversations-${scopeKey}`,
        onInsert: async ({ transaction, collection }) => {
          const mutation = transaction.mutations[0],
            created = await rpcJson(
              await conversationPost({
                json: {
                  participantUserIds: mutation.modified.participantId
                    ? [mutation.modified.participantId]
                    : [],
                  title: mutation.modified.title,
                },
              })
            );
          collection.utils.writeUpsert(created);
          return { refetch: false };
        },
        queryClient,
        queryFn: async ({ signal }) =>
          rpcJson(await conversationGet(undefined, { init: { signal } })),
        queryKey: ["messages", scopeKey, "conversations"],
        refetchInterval: MESSAGE_SYNC_INTERVAL_MS,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        staleTime: 5000,
      })
    ),
  makeLiveRoomChatCollection = (
    queryClient: QueryClient,
    scopeKey: string,
    roomId: string
  ) =>
    createCollection(
      queryCollectionOptions<LiveRoomChatMessage>({
        getKey: (message) => message.id,
        id: `soundkit-live-room-chat-${scopeKey}-${roomId}`,
        queryClient,
        queryFn: async ({ signal }) => {
          const response = await fetch(
            `${API_V1_URL}/live/rooms/${encodeURIComponent(roomId)}`,
            { credentials: "include", signal }
          );
          if (!response.ok) {
            throw new Error(
              `Unable to load live room chat: ${response.status}`
            );
          }
          const room = (await response.json()) as {
            chat?: LiveRoomChatMessage[];
          };
          return room.chat ?? [];
        },
        queryKey: ["messages", scopeKey, "live-room", roomId, "chat"],
        refetchInterval: MESSAGE_SYNC_INTERVAL_MS,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        staleTime: 5000,
      })
    ),
  makeMessageCollection = (
    queryClient: QueryClient,
    scopeKey: string,
    conversationId: string,
    conversations: ReturnType<typeof makeConversationCollection>
  ) =>
    createCollection(
      queryCollectionOptions<MessageSummary>({
        enabled: Boolean(conversationId),
        getKey: (message) => message.id,
        id: `soundkit-messages-${scopeKey}-${conversationId}`,
        onInsert: async ({ transaction, collection }) => {
          const mutation = transaction.mutations[0],
            message = mutation.modified,
            created = await rpcJson(
              await conversationMessagesPost({
                json: {
                  attachments: message.attachments.map((attachment) => ({
                    displayName: attachment.displayName,
                    mimeType: attachment.mimeType ?? undefined,
                    objectKey: attachment.objectKey ?? undefined,
                    sizeBytes: attachment.sizeBytes ?? undefined,
                    sourceProjectId: attachment.sourceProjectId ?? undefined,
                    sourceTrackId: attachment.sourceTrackId ?? undefined,
                    url: attachment.url,
                  })),
                  body: message.body,
                  clientMessageId: message.id,
                },
                param: { conversationId },
              })
            );
          collection.utils.writeUpsert(created);
          await conversations.utils.refetch();
          return { refetch: false };
        },
        queryClient,
        queryFn: async ({ signal }) =>
          conversationId
            ? rpcJson(
                await conversationMessagesGet(
                  { param: { conversationId } },
                  { init: { signal } }
                )
              )
            : [],
        queryKey: [
          "messages",
          scopeKey,
          "conversations",
          conversationId || "empty",
          "messages",
        ],
        refetchInterval: conversationId ? MESSAGE_SYNC_INTERVAL_MS : false,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        staleTime: 5000,
      })
    );

type ConversationCollection = ReturnType<typeof makeConversationCollection>;
type MessageCollection = ReturnType<typeof makeMessageCollection>;

type LiveRoomChatCollection = ReturnType<typeof makeLiveRoomChatCollection>;

interface MessagingCollections {
  conversations: ConversationCollection;
  getLiveRoomChat: (roomId: string) => LiveRoomChatCollection;
  getMessages: (conversationId: string) => MessageCollection;
}

interface MessagingDbContextValue extends MessagingCollections {
  activeConversationId: string;
  queryClient: QueryClient;
  setActiveConversationId: (conversationId: string) => void;
}

export interface StartConversationInput {
  conversation: {
    participantUserIds: string[];
    title?: string;
  };
  message?: {
    attachments: MessageAttachmentInput[];
    body: string;
  };
}

const MessagingDbContext = createContext<MessagingDbContextValue | null>(null),
  createCollections = (
    queryClient: QueryClient,
    scopeKey: string
  ): MessagingCollections => {
    const conversations = makeConversationCollection(queryClient, scopeKey),
      liveRoomChatCollections = new Map<string, LiveRoomChatCollection>(),
      messageCollections = new Map<string, MessageCollection>(),
      getLiveRoomChat = (roomId: string) => {
        const existing = liveRoomChatCollections.get(roomId);
        if (existing) {
          return existing;
        }
        const collection = makeLiveRoomChatCollection(
          queryClient,
          scopeKey,
          roomId
        );
        liveRoomChatCollections.set(roomId, collection);
        return collection;
      },
      getMessages = (conversationId: string) => {
        const collectionKey = conversationId || "empty",
          existing = messageCollections.get(collectionKey);
        if (existing) {
          return existing;
        }

        const collection = makeMessageCollection(
          queryClient,
          scopeKey,
          conversationId,
          conversations
        );
        messageCollections.set(collectionKey, collection);
        return collection;
      };

    return { conversations, getLiveRoomChat, getMessages };
  };

export function MessagingDbProvider({
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
    [activeConversationId, setActiveConversationId] = useState(""),
    value = useMemo(
      () => ({
        ...collections,
        activeConversationId,
        queryClient,
        setActiveConversationId,
      }),
      [activeConversationId, collections, queryClient, setActiveConversationId]
    );

  return (
    <MessagingDbContext.Provider value={value}>
      {children}
    </MessagingDbContext.Provider>
  );
}

const useMessagingDb = () => {
  const context = useContext(MessagingDbContext);
  if (!context) {
    throw new Error("MessagingDbProvider is required for messaging queries");
  }
  return context;
};

export const useMessagingWorkspace = () => {
  const { activeConversationId, setActiveConversationId } = useMessagingDb();
  return { activeConversationId, setActiveConversationId };
};

export const useMessagingConversations = () => {
  const { conversations } = useMessagingDb(),
    result = useLiveQuery((q) =>
      q
        .from({ conversation: conversations })
        .orderBy(({ conversation }) => conversation.updatedAt, "desc")
        .orderBy(({ conversation }) => conversation.id, "desc")
    ),
    refetch = useCallback(async () => {
      await conversations.utils.refetch();
    }, [conversations]);
  return { ...result, refetch };
};

export const useLiveRoomChat = (roomId: string) => {
  const { getLiveRoomChat } = useMessagingDb(),
    collection = useMemo(
      () => getLiveRoomChat(roomId),
      [getLiveRoomChat, roomId]
    ),
    result = useLiveQuery((q) =>
      q
        .from({ message: collection })
        .orderBy(({ message }) => message.sentAt, "asc")
        .orderBy(({ message }) => message.id, "asc")
    ),
    data = result.data as unknown as LiveRoomChatMessage[];

  return { ...result, collection, data };
};

export const useMessagingMessages = (conversationId: string) => {
  const { getMessages } = useMessagingDb(),
    collection = useMemo(
      () => getMessages(conversationId),
      [conversationId, getMessages]
    ),
    result = useLiveQuery(
      (q) =>
        conversationId
          ? q
              .from({ message: collection })
              .orderBy(({ message }) => message.createdAt, "asc")
              .orderBy(({ message }) => message.id, "asc")
          : undefined,
      [collection, conversationId]
    ),
    data = (result.data ?? []) as unknown as MessageSummary[],
    refetch = useCallback(async () => {
      await collection.utils.refetch();
    }, [collection]);
  return { ...result, collection, data, refetch };
};

export const useMarkConversationReadMutation = () => {
  const { conversations, queryClient } = useMessagingDb(),
    [pendingConversationIds, setPendingConversationIds] = useState<Set<string>>(
      () => new Set()
    ),
    markRead = useMemo(
      () =>
        createOptimisticAction<string>({
          mutationFn: async (conversationId) => {
            await rpcJson(
              await conversationReadPost({ param: { conversationId } })
            );
            await Promise.all([
              conversations.utils.refetch(),
              queryClient.invalidateQueries({
                queryKey: NOTIFICATIONS_QUERY_KEY,
              }),
            ]);
          },
          onMutate: (conversationId) => {
            const conversation = conversations.toArray.find(
              (item) => item.id === conversationId
            );
            if (conversation && conversation.unreadCount > 0) {
              conversations.update(conversationId, (draft) => {
                draft.unreadCount = 0;
              });
            }
          },
        }),
      [conversations, queryClient]
    ),
    mutate = useCallback(
      (conversationId: string) => {
        const conversation = conversations.toArray.find(
          (item) => item.id === conversationId
        );
        if (
          !conversation ||
          conversation.unreadCount === 0 ||
          pendingConversationIds.has(conversationId)
        ) {
          return;
        }

        setPendingConversationIds((current) =>
          new Set(current).add(conversationId)
        );
        const transaction = markRead(conversationId),
          clearPending = () => {
            setPendingConversationIds((current) => {
              const next = new Set(current);
              next.delete(conversationId);
              return next;
            });
          };
        void transaction.isPersisted.promise.then(clearPending, clearPending);
      },
      [
        conversations,
        markRead,
        pendingConversationIds,
        setPendingConversationIds,
      ]
    );

  return { isPending: pendingConversationIds.size > 0, mutate };
};

export const useStartConversationMutation = () => {
  const { conversations } = useMessagingDb();

  return useMutation({
    mutationFn: async ({
      conversation,
      message,
    }: StartConversationInput): Promise<ConversationSummary> => {
      const createdConversation = await rpcJson(
        await conversationPost({ json: conversation })
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
    onSuccess: async (createdConversation, { message }) => {
      conversations.utils.writeUpsert(createdConversation);
      if (message?.body && message.body.trim()) {
        await conversations.utils.refetch();
      }
    },
  });
};

export const useCreateMessageCollectionMutation = (
  conversationId: string,
  senderId?: string
) => {
  const { getMessages } = useMessagingDb(),
    collection = useMemo(
      () => getMessages(conversationId),
      [conversationId, getMessages]
    ),
    [isPending, setIsPending] = useState(false),
    mutate = useCallback(
      (
        input: CreateMessageCollectionInput,
        options?: MessageCollectionMutationOptions
      ) => {
        if (!conversationId || !senderId) {
          return;
        }

        const optimisticMessage: MessageSummary = {
          attachments: input.attachments.map((attachment) => ({
            displayName: attachment.displayName,
            id: `local-${crypto.randomUUID()}`,
            mimeType: attachment.mimeType ?? null,
            objectKey: attachment.objectKey ?? null,
            sizeBytes: attachment.sizeBytes ?? null,
            sourceProjectId: attachment.sourceProjectId ?? null,
            sourceTrackId: attachment.sourceTrackId ?? null,
            url: attachment.url,
          })),
          body: input.body,
          createdAt: new Date().toISOString(),
          id: crypto.randomUUID(),
          senderId,
          status: "sent",
        };

        setIsPending(true);
        try {
          const transaction = collection.insert(optimisticMessage);
          void transaction.isPersisted.promise
            .then(() => {
              options?.onSuccess?.(optimisticMessage);
            })
            .catch((error: unknown) => {
              options?.onError?.(error);
            })
            .finally(() => setIsPending(false));
        } catch (error) {
          setIsPending(false);
          options?.onError?.(error);
        }
      },
      [conversationId, collection, senderId]
    );

  return { isPending, mutate };
};
