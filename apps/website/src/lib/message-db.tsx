import { queryCollectionOptions } from "@tanstack/query-db-collection";
/* eslint-disable one-var, sort-vars, prefer-destructuring, promise/prefer-await-to-then, promise/prefer-await-to-callbacks, react/hook-use-state */
import { createCollection, useLiveQuery } from "@tanstack/react-db";
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
    apiClient.v1.messages.conversations[":conversationId"].messages.$post;

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

const compareMessageChronology = <
  T extends { createdAt?: string; id: string; sentAt?: string },
>(
  left: T,
  right: T
) => {
  const leftTime = Date.parse(left.createdAt ?? left.sentAt ?? ""),
    rightTime = Date.parse(right.createdAt ?? right.sentAt ?? ""),
    normalizedLeftTime = Number.isNaN(leftTime) ? 0 : leftTime,
    normalizedRightTime = Number.isNaN(rightTime) ? 0 : rightTime;

  return (
    normalizedLeftTime - normalizedRightTime || left.id.localeCompare(right.id)
  );
};

const makeConversationCollection = (queryClient: QueryClient) =>
    createCollection(
      queryCollectionOptions<ConversationSummary>({
        getKey: (conversation) => conversation.id,
        id: "soundkit-conversations",
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
        queryFn: async () => rpcJson(await conversationGet()),
        queryKey: ["messages", "conversations"],
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      })
    ),
  makeLiveRoomChatCollection = (queryClient: QueryClient, roomId: string) =>
    createCollection(
      queryCollectionOptions<LiveRoomChatMessage>({
        getKey: (message) => message.id,
        id: `soundkit-live-room-chat-${roomId}`,
        queryClient,
        queryFn: async () => {
          const response = await fetch(
            `${API_V1_URL}/live/rooms/${encodeURIComponent(roomId)}`,
            { credentials: "include" }
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
        queryKey: ["live-room", roomId, "chat"],
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      })
    ),
  makeMessageCollection = (queryClient: QueryClient, conversationId: string) =>
    createCollection(
      queryCollectionOptions<MessageSummary>({
        enabled: Boolean(conversationId),
        getKey: (message) => message.id,
        id: `soundkit-messages-${conversationId}`,
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
          return { refetch: false };
        },
        queryClient,
        queryFn: async () =>
          conversationId
            ? rpcJson(
                await conversationMessagesGet({ param: { conversationId } })
              )
            : [],
        queryKey: [
          "messages",
          "conversations",
          conversationId || "empty",
          "messages",
        ],
        refetchOnWindowFocus: false,
        staleTime: 30_000,
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
  queryClient: QueryClient;
}

const MessagingDbContext = createContext<MessagingDbContextValue | null>(null),
  createCollections = (queryClient: QueryClient): MessagingCollections => {
    const conversations = makeConversationCollection(queryClient),
      liveRoomChatCollections = new Map<string, LiveRoomChatCollection>(),
      messageCollections = new Map<string, MessageCollection>(),
      getLiveRoomChat = (roomId: string) => {
        const existing = liveRoomChatCollections.get(roomId);
        if (existing) {
          return existing;
        }
        const collection = makeLiveRoomChatCollection(queryClient, roomId);
        liveRoomChatCollections.set(roomId, collection);
        return collection;
      },
      getMessages = (conversationId: string) => {
        const collectionKey = conversationId || "empty",
          existing = messageCollections.get(collectionKey);
        if (existing) {
          return existing;
        }

        const collection = makeMessageCollection(queryClient, conversationId);
        messageCollections.set(collectionKey, collection);
        return collection;
      };

    return { conversations, getLiveRoomChat, getMessages };
  };

export function MessagingDbProvider({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  const [collections] = useState(() => createCollections(queryClient)),
    value = useMemo(
      () => ({ ...collections, queryClient }),
      [collections, queryClient]
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

export const useMessagingConversations = () => {
  const { conversations } = useMessagingDb();
  return useLiveQuery(conversations);
};

export const useLiveRoomChat = (roomId: string) => {
  const { getLiveRoomChat } = useMessagingDb(),
    collection = useMemo(
      () => getLiveRoomChat(roomId),
      [getLiveRoomChat, roomId]
    ),
    result = useLiveQuery(collection),
    data = useMemo(
      () =>
        [...(result.data as unknown as LiveRoomChatMessage[])].sort(
          compareMessageChronology
        ),
      [result.data]
    );

  return { ...result, collection, data };
};

export const useMessagingMessages = (conversationId: string) => {
  const { getMessages } = useMessagingDb(),
    collection = useMemo(
      () => getMessages(conversationId),
      [conversationId, getMessages]
    ),
    result = useLiveQuery(collection),
    data = useMemo(
      () =>
        [...(result.data as unknown as MessageSummary[])].sort(
          compareMessageChronology
        ),
      [result.data]
    ),
    refetch = useCallback(async () => {
      await collection.utils.refetch();
    }, [collection]);
  return { ...result, data, refetch };
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
