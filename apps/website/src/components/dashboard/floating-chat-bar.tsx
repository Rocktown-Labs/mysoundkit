import { X, MessageCircle, Send, Users, UserPlus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  useConversationMessagesQuery,
  useConversationsQuery,
  useCreateMessageMutation,
  useFriendsQuery,
  useMeQuery,
  useStartConversationMutation,
} from "@/lib/soundkit-api-hooks";
import type { FriendSummary } from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

const FALLBACK_AVATAR = "/diverse-user-avatars.png",

 formatMessageTime = (createdAt: string) => {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
};

export function FloatingChatBar() {
  const [activeConversationId, setActiveConversationId] = useState(""),
   [isOpen, setIsOpen] = useState(false),
   [tab, setTab] = useState<"chats" | "friends">("chats"),
   [messageInput, setMessageInput] = useState(""),
   { currentTrack } = useAudioPlayer(),
   meQuery = useMeQuery(),
   isArtist =
    meQuery.data?.user.accountType === "artist" ||
    meQuery.data?.user.role === "admin",

   conversationsQuery = useConversationsQuery(isArtist),
   friendsQuery = useFriendsQuery(),
   startConversation = useStartConversationMutation(),

   conversations = conversationsQuery.data ?? [],
   friends = useMemo(
    () => (Array.isArray(friendsQuery.data) ? friendsQuery.data : []),
    [friendsQuery.data]
  ),

   activeConversation =
    conversations.find(({ id }) => id === activeConversationId) ??
    conversations[0] ??
    null,
   conversationId = activeConversation?.id ?? "",
   messagesQuery = useConversationMessagesQuery(conversationId),
   createMessage = useCreateMessageMutation(conversationId);

  if (!isArtist) {
    return null;
  }

  const messages = messagesQuery.data ?? [],
   totalUnread = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0
  ),

   handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = messageInput.trim();

    if (!body || !conversationId || createMessage.isPending) {
      return;
    }

    createMessage.mutate(
      { body },
      {
        onError: () =>
          toast({
            description: "Could not send your message. Please try again.",
            title: "Message failed",
            variant: "destructive",
          }),
        onSuccess: () => setMessageInput(""),
      }
    );
  },

   handleStartFriendChat = (friend: FriendSummary) => {
    // Check if conversation already exists
    const existing = conversations.find(
      (c) =>
        c.participantName === friend.name ||
        c.participantUsername === friend.username
    );

    if (existing) {
      setActiveConversationId(existing.id);
      setTab("chats");
      return;
    }

    startConversation.mutate(
      {
        conversation: {
          participantUserIds: [friend.id],
          title: friend.name,
        },
        message: { body: "Hey! Let's connect on SoundKit." },
      },
      {
        onError: () => {
          toast({
            description: "Could not start chat. Please try again.",
            variant: "destructive",
          });
        },
        onSuccess: (res) => {
          if (res?.id) {
            setActiveConversationId(res.id);
          }
          setTab("chats");
          toast({ description: `Chat started with ${friend.name}` });
        },
      }
    );
  },

  // Position dynamically: if audio player is active on mobile, lift above it
   bottomPositionClass = currentTrack
    ? "bottom-28 sm:bottom-6"
    : "bottom-20 sm:bottom-6";

  return (
    <div
      className={cn(
        "fixed right-4 sm:right-6 z-40 transition-all duration-300",
        bottomPositionClass
      )}
    >
      {isOpen ? (
        <Card className="w-[340px] sm:w-[440px] shadow-2xl border-primary/30 bg-card/95 backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200">
          <CardHeader className="p-3 border-b flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-5 text-primary" />
              <CardTitle className="text-sm sm:text-base font-bold">
                Artist Messages
              </CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex items-center rounded-lg border p-0.5 bg-muted/40 text-xs mr-1">
                <button
                  type="button"
                  onClick={() => setTab("chats")}
                  className={cn(
                    "px-2 py-1 rounded text-xs font-medium transition",
                    tab === "chats"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Chats ({conversations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab("friends")}
                  className={cn(
                    "px-2 py-1 rounded text-xs font-medium transition",
                    tab === "friends"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Friends ({friends.length})
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-full"
                onClick={() => setIsOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {tab === "friends" ? (
              <div className="h-[350px] overflow-y-auto p-2 space-y-1">
                <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Friends & Collaborators
                </div>
                {friends.length > 0 ? (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/60 transition group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative">
                          <Avatar className="size-8">
                            <AvatarImage
                              src={friend.avatarUrl ?? FALLBACK_AVATAR}
                            />
                            <AvatarFallback>
                              {friend.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-1 ring-background" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">
                            {friend.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {friend.username
                              ? `@${friend.username}`
                              : friend.role}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => handleStartFriendChat(friend)}
                        disabled={startConversation.isPending}
                        className="text-xs h-7 gap-1"
                      >
                        <MessageCircle className="size-3" />
                        Chat
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No friends or collaborators yet.
                  </div>
                )}
              </div>
            ) : (conversations.length > 0 ? (
              <>
                <div className="flex items-center gap-1.5 p-2 border-b bg-muted/30 overflow-x-auto">
                  {conversations.map((conversation) => {
                    const name =
                      conversation.participantName ?? conversation.title;

                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => setActiveConversationId(conversation.id)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0",
                          activeConversation?.id === conversation.id
                            ? "bg-primary text-primary-foreground shadow"
                            : "hover:bg-muted/60 text-muted-foreground"
                        )}
                      >
                        <Avatar className="size-4">
                          <AvatarImage
                            src={
                              conversation.participantAvatarUrl ??
                              FALLBACK_AVATAR
                            }
                          />
                          <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[100px]">{name}</span>
                        {conversation.unreadCount > 0 &&
                          activeConversation?.id !== conversation.id && (
                            <Badge
                              variant="destructive"
                              className="size-2 rounded-full p-0"
                            />
                          )}
                      </button>
                    );
                  })}
                </div>

                {activeConversation ? (
                  <div className="flex flex-col h-[350px]">
                    <div className="px-3 py-2 bg-muted/20 border-b flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground truncate max-w-[200px]">
                        {activeConversation.participantUsername
                          ? `@${activeConversation.participantUsername}`
                          : activeConversation.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                        Direct message
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                      {messages.length > 0 ? (
                        messages.map((message) => {
                          const isSelf =
                            message.senderId === meQuery.data?.user.id;

                          return (
                            <div
                              key={message.id}
                              className={cn(
                                "flex flex-col max-w-[88%]",
                                isSelf ? "ml-auto items-end" : "items-start"
                              )}
                            >
                              <div
                                className={cn(
                                  "p-3 rounded-2xl text-xs space-y-1.5",
                                  isSelf
                                    ? "bg-primary text-primary-foreground rounded-br-none"
                                    : "bg-muted text-foreground rounded-bl-none"
                                )}
                              >
                                <p>{message.body}</p>
                              </div>
                              <span className="text-[9px] text-muted-foreground px-1 mt-0.5">
                                {formatMessageTime(message.createdAt)}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-center text-xs text-muted-foreground py-12">
                          No messages yet. Start the conversation.
                        </p>
                      )}
                    </div>

                    <form
                      onSubmit={handleSendMessage}
                      className="p-2 border-t flex items-center gap-2 bg-background"
                    >
                      <Input
                        value={messageInput}
                        onChange={(event) =>
                          setMessageInput(event.target.value)
                        }
                        placeholder="Type a message..."
                        className="h-8 text-xs flex-1"
                      />
                      <Button
                        type="submit"
                        size="icon"
                        className="size-8 shrink-0"
                        disabled={createMessage.isPending}
                      >
                        <Send className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="p-6 text-center space-y-3">
                <p className="text-xs text-muted-foreground">
                  No open chats right now. Start messaging friends or
                  collaborators!
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTab("friends")}
                  className="gap-2 text-xs"
                >
                  <Users className="size-3.5" />
                  View Friends ({friends.length})
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full shadow-2xl h-11 sm:h-12 px-4 sm:px-5 gap-2.5 bg-primary text-primary-foreground hover:scale-105 transition-transform"
        >
          <MessageCircle className="size-5" />
          <span className="font-semibold text-xs sm:text-sm">Artist Chat</span>
          {totalUnread > 0 && (
            <Badge
              variant="secondary"
              className="px-2 py-0.5 text-xs font-bold"
            >
              {totalUnread}
            </Badge>
          )}
        </Button>
      )}
    </div>
  );
}
