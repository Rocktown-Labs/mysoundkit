import { useRouterState } from "@tanstack/react-router";
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
import { usePresence } from "@/lib/presence-context";
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
    pathname = useRouterState({
      select: (state) => state.location.pathname,
    }),
    meQuery = useMeQuery(),
    isArtist =
      meQuery.data?.user.accountType === "artist" ||
      meQuery.data?.user.role === "admin",
    conversationsQuery = useConversationsQuery(isArtist),
    friendsQuery = useFriendsQuery(),
    startConversation = useStartConversationMutation(),
    { isUserOnline } = usePresence(),
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

  if (!isArtist || pathname.startsWith("/dashboard/messages")) {
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
    // Position dynamically: if audio player is active, dock comfortably above it
    bottomPositionClass = currentTrack
      ? "bottom-36 sm:bottom-28 right-4 sm:right-6"
      : "bottom-20 sm:bottom-6 right-4 sm:right-6";

  return (
    <div
      className={cn(
        "fixed z-40 transition-all duration-300",
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
            <div className="flex items-center gap-1.5">
              <div className="flex items-center rounded-lg border p-0.5 bg-muted/40 text-xs">
                <button
                  type="button"
                  onClick={() => setTab("chats")}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition",
                    tab === "chats"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Chats ({conversations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab("friends")}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition",
                    tab === "friends"
                      ? "bg-primary text-primary-foreground shadow-sm"
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
                aria-label="Minimize Chat"
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
                          <span
                            className={cn(
                              "absolute bottom-0 right-0 size-2 rounded-full ring-1 ring-background transition-colors",
                              isUserOnline(friend.id)
                                ? "bg-emerald-500 shadow-sm animate-pulse"
                                : "bg-muted-foreground/30"
                            )}
                          />
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
                        size="sm"
                        variant="secondary"
                        onClick={() => handleStartFriendChat(friend)}
                        disabled={startConversation.isPending}
                        className="text-xs h-8 px-3 gap-1.5"
                      >
                        <MessageCircle className="size-3.5" />
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
                    const isSelected = conversation.id === conversationId;
                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => setActiveConversationId(conversation.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs shrink-0 transition",
                          isSelected
                            ? "bg-primary text-primary-foreground font-medium shadow-sm"
                            : "bg-background/80 hover:bg-background text-muted-foreground"
                        )}
                      >
                        <span className="max-w-[100px] truncate">
                          {conversation.participantName ?? conversation.title}
                        </span>
                        {conversation.unreadCount > 0 && (
                          <Badge
                            variant={isSelected ? "secondary" : "default"}
                            className="size-4 p-0 text-[10px] flex items-center justify-center rounded-full"
                          >
                            {conversation.unreadCount}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>

                {activeConversation ? (
                  <div className="flex flex-col h-[350px]">
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {messages.length > 0 ? (
                        messages.map((message) => {
                          const isMine =
                            message.senderUserId === meQuery.data?.user.id;
                          return (
                            <div
                              key={message.id}
                              className={cn(
                                "flex flex-col max-w-[80%]",
                                isMine
                                  ? "ml-auto items-end"
                                  : "mr-auto items-start"
                              )}
                            >
                              <div
                                className={cn(
                                  "rounded-2xl px-3 py-2 text-xs",
                                  isMine
                                    ? "bg-primary text-primary-foreground rounded-br-none"
                                    : "bg-muted text-foreground rounded-bl-none"
                                )}
                              >
                                {message.body}
                              </div>
                              <span className="text-[9px] text-muted-foreground mt-0.5 px-1">
                                {formatMessageTime(message.createdAt)}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                          Send a message to start chatting
                        </div>
                      )}
                    </div>

                    <form
                      onSubmit={handleSendMessage}
                      className="p-2.5 border-t bg-background/50 flex items-center gap-2"
                    >
                      <Input
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder={`Message ${activeConversation.participantName ?? "artist"}...`}
                        className="h-9 text-xs"
                      />
                      <Button
                        type="submit"
                        size="icon"
                        className="size-9 shrink-0"
                        disabled={
                          createMessage.isPending || !messageInput.trim()
                        }
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
          aria-label="Open Artist Chat"
          className="relative size-12 rounded-full shadow-2xl bg-primary text-primary-foreground hover:scale-105 transition-transform flex items-center justify-center p-0"
        >
          <MessageCircle className="size-5" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse shadow-md">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </Button>
      )}
    </div>
  );
}
