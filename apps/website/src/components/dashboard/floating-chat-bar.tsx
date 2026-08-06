"use client";

import { X, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

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
  useMeQuery,
} from "@/lib/soundkit-api-hooks";

const FALLBACK_AVATAR = "/diverse-user-avatars.png";

const formatMessageTime = (createdAt: string) => {
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
  const [activeConversationId, setActiveConversationId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const meQuery = useMeQuery();
  const isArtist =
    meQuery.data?.user.accountType === "artist" ||
    meQuery.data?.user.role === "admin";
  const conversationsQuery = useConversationsQuery(isArtist);
  const conversations = conversationsQuery.data ?? [];
  const activeConversation =
    conversations.find(({ id }) => id === activeConversationId) ??
    conversations[0] ??
    null;
  const conversationId = activeConversation?.id ?? "";
  const messagesQuery = useConversationMessagesQuery(conversationId);
  const createMessage = useCreateMessageMutation(conversationId);
  if (!isArtist) {
    return null;
  }

  const messages = messagesQuery.data ?? [];
  const totalUnread = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0
  );

  const handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
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
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <Card className="w-[360px] sm:w-[440px] shadow-2xl border-primary/30 bg-card/95 backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200">
          <CardHeader className="p-3 border-b flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-5 text-primary" />
              <CardTitle className="text-base font-bold">
                Artist Direct Messages
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full"
              onClick={() => setIsOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            {conversations.length > 0 ? (
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
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          activeConversation?.id === conversation.id
                            ? "bg-primary text-primary-foreground shadow"
                            : "hover:bg-muted/60 text-muted-foreground"
                        }`}
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
                      <span className="font-semibold text-foreground">
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
                              className={`flex flex-col max-w-[88%] ${
                                isSelf ? "ml-auto items-end" : "items-start"
                              }`}
                            >
                              <div
                                className={`p-3 rounded-2xl text-xs space-y-1.5 ${
                                  isSelf
                                    ? "bg-primary text-primary-foreground rounded-br-none"
                                    : "bg-muted text-foreground rounded-bl-none"
                                }`}
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
              <p className="p-8 text-center text-xs text-muted-foreground">
                No conversations yet.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full shadow-2xl h-12 px-5 gap-3 bg-primary text-primary-foreground hover:scale-105 transition-transform"
        >
          <MessageCircle className="size-5" />
          <span className="font-semibold text-sm">Artist Chat</span>
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
