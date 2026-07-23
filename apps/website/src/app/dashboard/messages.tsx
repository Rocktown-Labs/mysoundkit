import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LoaderCircle,
  MessageSquare,
  Plus,
  Search,
  Send,
  Star,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useConversationMessagesQuery,
  useConversationsQuery,
  useCreateMessageMutation,
  useFriendsQuery,
  useStartConversationMutation,
} from "@/lib/soundkit-api-hooks";
import type {
  ConversationSummary,
  FriendSummary,
} from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/messages")({
  component: MessagesPage,
});

const initials = (value: string) =>
  value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function MessagesPage() {
  const conversationsQuery = useConversationsQuery();
  const conversations = useMemo(
    () => conversationsQuery.data ?? [],
    [conversationsQuery.data]
  );
  const [selectedId, setSelectedId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [composerText, setComposerText] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  useEffect(() => {
    if (!selectedId && conversations[0]) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedId
  );
  const messagesQuery = useConversationMessagesQuery(selectedId);
  const sendMessage = useCreateMessageMutation(selectedId);
  const filteredConversations = conversations.filter((conversation) =>
    conversation.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!(selectedId && composerText.trim())) {
      return;
    }

    sendMessage.mutate(
      { body: composerText.trim() },
      {
        onSuccess: () => setComposerText(""),
      }
    );
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold tracking-tight">
            Messages
          </h1>
          <p className="mt-1 text-muted-foreground">
            Chat with your collaborators
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="bg-card/40 border-border/40"
            size="sm"
            variant="outline"
          >
            <Star className="mr-2 size-3.5" />
            Starred
          </Button>
          <Button
            className="shadow-lg shadow-primary/20"
            onClick={() => setIsNewChatOpen(true)}
            size="sm"
          >
            <Plus className="mr-2 size-3.5" />
            New Chat
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <Card className="flex h-full w-full flex-col overflow-hidden border-border/40 bg-card/40 backdrop-blur-md md:w-80">
          <div className="border-b border-border/20 p-4">
            <div className="relative">
              <Search className="-translate-y-1/2 absolute left-3 top-1/2 size-4 text-muted-foreground" />
              <Input
                className="border-none bg-muted/30 pl-9 focus-visible:ring-1 focus-visible:ring-primary/30"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search chats..."
                value={searchQuery}
              />
            </div>
          </div>
          <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-2">
            {conversationsQuery.isLoading && (
              <p className="p-4 text-sm text-muted-foreground">
                Loading conversations...
              </p>
            )}
            {!conversationsQuery.isLoading &&
              filteredConversations.length === 0 && (
                <div className="p-6 text-center">
                  <MessageSquare className="mx-auto mb-3 size-8 text-muted-foreground/30" />
                  <p className="font-medium text-sm">No conversations</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Start a new chat with a friend or collaborator.
                  </p>
                </div>
              )}
            {filteredConversations.map((conversation) => (
              <ConversationItem
                conversation={conversation}
                isSelected={selectedId === conversation.id}
                key={conversation.id}
                onClick={() => setSelectedId(conversation.id)}
              />
            ))}
          </div>
        </Card>

        <Card className="hidden flex-1 flex-col overflow-hidden border-border/40 bg-card/20 backdrop-blur-xl md:flex">
          {selectedConversation ? (
            <>
              <div className="flex items-center justify-between border-b border-border/20 bg-white/[0.02] p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10 border-2 border-border/40">
                    <AvatarFallback>
                      {initials(selectedConversation.title)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-sm leading-none">
                      {selectedConversation.title}
                    </h3>
                    <Badge className="mt-2 capitalize" variant="secondary">
                      {selectedConversation.conversationType}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-6">
                {messagesQuery.isLoading && (
                  <p className="text-sm text-muted-foreground">
                    Loading messages...
                  </p>
                )}
                {(messagesQuery.data ?? []).map((message) => (
                  <div className="flex justify-start" key={message.id}>
                    <div className="max-w-[75%] rounded-2xl rounded-bl-none border border-border/20 bg-muted/80 px-4 py-3 text-sm">
                      <p>{message.body}</p>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {new Date(message.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {!messagesQuery.isLoading &&
                  (messagesQuery.data ?? []).length === 0 && (
                    <div className="py-12 text-center">
                      <MessageSquare className="mx-auto mb-3 size-8 text-muted-foreground/30" />
                      <p className="font-medium">No messages yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Send the first message to get this chat moving.
                      </p>
                    </div>
                  )}
              </div>

              <form
                className="border-t border-border/20 bg-white/[0.01] p-4"
                onSubmit={submitMessage}
              >
                <div className="flex items-center gap-2 rounded-2xl border border-border/20 bg-muted/40 p-1.5 pl-3 backdrop-blur-xl transition-all focus-within:ring-1 focus-within:ring-primary/20">
                  <Input
                    className="h-10 border-none bg-transparent px-1 text-sm focus-visible:ring-0"
                    onChange={(event) => setComposerText(event.target.value)}
                    placeholder="Type your message..."
                    value={composerText}
                  />
                  <Button
                    className="size-10 shrink-0 rounded-xl shadow-lg shadow-primary/20"
                    disabled={!composerText.trim() || sendMessage.isPending}
                    size="icon"
                    type="submit"
                  >
                    {sendMessage.isPending ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <MessageSquare className="mx-auto mb-3 size-10 text-muted-foreground/30" />
                <p className="font-medium">Select or start a conversation</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your real collaborator messages will appear here.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <NewChatDialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen} />
    </div>
  );
}

function NewChatDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const friendsQuery = useFriendsQuery();
  const startConversation = useStartConversationMutation();
  const [selectedFriends, setSelectedFriends] = useState<FriendSummary[]>([]);
  const [message, setMessage] = useState("");
  const normalizedSearch = search.trim().replace(/^@/, "").toLowerCase();
  const filteredFriends = friends.filter((friend) =>
    [friend.name, friend.username, friend.email, friend.role]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedSearch))
  );
  const selectedIds = new Set(selectedFriends.map((friend) => friend.id));
  const availableFriends = filteredFriends.filter(
    (friend) => !selectedIds.has(friend.id)
  );

  const startChat = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedFriends.length === 0 || !message.trim()) {
      return;
    }

    startConversation.mutate(
      {
        conversation: {
          participantUserIds: selectedFriends.map((friend) => friend.id),
          title: selectedFriends.map((friend) => friend.name).join(", "),
        },
        message: { body: message.trim() },
      },
      {
        onSuccess: () => {
          setMessage("");
          setSearch("");
          setSelectedFriends([]);
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Chat</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={startChat}>
          <div className="space-y-2">
            <Input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search friends or collaborators"
              value={search}
            />
            <div className="flex flex-wrap gap-2">
              {selectedFriends.map((friend) => (
                <Badge className="gap-1" key={friend.id} variant="secondary">
                  {friend.name}
                  <button
                    aria-label={`Remove ${friend.name}`}
                    onClick={() =>
                      setSelectedFriends((current) =>
                        current.filter((item) => item.id !== friend.id)
                      )
                    }
                    type="button"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-border/40 p-2">
            {availableFriends.map((friend) => (
              <button
                className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted"
                key={friend.id}
                onClick={() =>
                  setSelectedFriends((current) => [...current, friend])
                }
                type="button"
              >
                <Avatar className="size-8">
                  <AvatarImage src={friend.avatarUrl ?? undefined} />
                  <AvatarFallback>{initials(friend.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{friend.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {friend.username ? `@${friend.username}` : friend.email}
                  </p>
                </div>
              </button>
            ))}
            {availableFriends.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No friends or collaborators match that search.
              </p>
            )}
          </div>

          <Textarea
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write the first message"
            value={message}
          />

          <div className="flex justify-between gap-3">
            <Button asChild={true} type="button" variant="outline">
              <Link to="/dashboard/collaborators">Add Friend</Link>
            </Button>
            <Button
              disabled={
                selectedFriends.length === 0 ||
                !message.trim() ||
                startConversation.isPending
              }
              type="submit"
            >
              {startConversation.isPending && (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              )}
              Start Chat
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: ConversationSummary;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
        isSelected
          ? "border-primary/20 bg-primary/10 shadow-sm"
          : "border-transparent hover:bg-muted/50"
      )}
      onClick={onClick}
      type="button"
    >
      {isSelected && (
        <div className="-left-1 absolute top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
      )}
      <Avatar className="size-11 border-2 border-border/10 transition-colors group-hover:border-primary/20">
        <AvatarFallback className="bg-muted text-xs">
          {initials(conversation.title)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between">
          <p
            className={cn(
              "font-semibold text-xs transition-colors",
              isSelected ? "text-primary" : "text-foreground"
            )}
          >
            {conversation.title}
          </p>
          <span className="font-medium text-[10px] text-muted-foreground/60">
            {new Date(conversation.updatedAt).toLocaleDateString()}
          </span>
        </div>
        <p className="truncate pr-4 text-[11px] text-muted-foreground/80 leading-normal">
          {conversation.conversationType}
        </p>
        {conversation.unreadCount > 0 && (
          <div className="mt-1 flex size-4 items-center justify-center rounded-full bg-primary">
            <span className="font-bold text-[9px] text-primary-foreground">
              {conversation.unreadCount}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
