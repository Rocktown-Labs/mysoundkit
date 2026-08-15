"use client";

import { useUploadFiles } from "@better-upload/client";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FolderKanban,
  LoaderCircle,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  Sparkles,
  Star,
  UserCheck,
  UserRoundPlus,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { API_V1_URL, MEDIA_BASE_URL, MEDIA_UPLOAD_URL } from "@/lib/api";
import {
  useConversationMessagesQuery,
  useConversationsQuery,
  useCreateMessageMutation,
  useFriendsQuery,
  useLibraryPurchasesQuery,
  useLibrarySavedQuery,
  usePeopleSearchQuery,
  useStartConversationMutation,
} from "@/lib/soundkit-api-hooks";
import type {
  ConversationSummary,
  FriendSummary,
} from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

interface MessagesSearch {
  conversationId?: string;
  friendId?: string;
}

export const Route = createFileRoute("/dashboard/messages")({
  component: MessagesPage,
  validateSearch: (search: Record<string, unknown>): MessagesSearch => ({
    conversationId:
      typeof search.conversationId === "string" && search.conversationId
        ? search.conversationId
        : undefined,
    friendId:
      typeof search.friendId === "string" && search.friendId
        ? search.friendId
        : undefined,
  }),
});

const initials = (value: string) =>
  value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function MessagesPage() {
  const searchParams = Route.useSearch(),
    conversationsQuery = useConversationsQuery(),
    friendsQuery = useFriendsQuery(),
    conversations = useMemo(
      () =>
        Array.isArray(conversationsQuery.data) ? conversationsQuery.data : [],
      [conversationsQuery.data]
    ),
    friends = useMemo(
      () => (Array.isArray(friendsQuery.data) ? friendsQuery.data : []),
      [friendsQuery.data]
    ),
    // Messageable connections: mutual friends & track collaborators
    messageableFriends = useMemo(
      () =>
        friends.filter(
          (friend) =>
            friend.relationship === "friend" ||
            friend.relationship === "collaborator"
        ),
      [friends]
    ),
    [selectedId, setSelectedId] = useState(""),
    [searchQuery, setSearchQuery] = useState(""),
    [attachments, setAttachments] = useState<
      {
        displayName: string;
        mimeType?: string;
        objectKey?: string;
        sizeBytes?: number;
        sourceTrackId?: string;
        url: string;
      }[]
    >([]),
    [composerText, setComposerText] = useState(""),
    [isCollaborationOpen, setIsCollaborationOpen] = useState(false),
    [isNewChatOpen, setIsNewChatOpen] = useState(false),
    [targetFriendId, setTargetFriendId] = useState<string | undefined>();

  // Handle URL search params (friendId or conversationId)
  useEffect(() => {
    if (searchParams.conversationId) {
      setSelectedId(searchParams.conversationId);
      return;
    }

    if (searchParams.friendId) {
      const targetFriend = friends.find((f) => f.id === searchParams.friendId),
        // Check if conversation already exists with this friend
        existing = conversations.find(
          (c) =>
            targetFriend &&
            (c.title.toLowerCase().includes(targetFriend.name.toLowerCase()) ||
              (targetFriend.username &&
                c.title
                  .toLowerCase()
                  .includes(targetFriend.username.toLowerCase())))
        );

      if (existing) {
        setSelectedId(existing.id);
      } else {
        setTargetFriendId(searchParams.friendId);
        setIsNewChatOpen(true);
      }
      return;
    }

    if (!selectedId && conversations[0]) {
      setSelectedId(conversations[0].id);
    }
  }, [
    conversations,
    friends,
    searchParams.conversationId,
    searchParams.friendId,
    selectedId,
  ]);

  const selectedConversation = conversations.find(
      (conversation) => conversation.id === selectedId
    ),
    messagesQuery = useConversationMessagesQuery(selectedId),
    sendMessage = useCreateMessageMutation(selectedId),
    purchasesQuery = useLibraryPurchasesQuery(),
    savedTracksQuery = useLibrarySavedQuery(),
    { isPending: isUploading, upload } = useUploadFiles({
      api: MEDIA_UPLOAD_URL,
      credentials: "include",
      onUploadComplete: ({ files }) => {
        setAttachments((current) => [
          ...current,
          ...files.map((file) => ({
            displayName: file.raw.name,
            mimeType: file.raw.type,
            objectKey: file.objectInfo.key,
            sizeBytes: file.raw.size,
            url: `${MEDIA_BASE_URL}/${file.objectInfo.key}`,
          })),
        ]);
      },
    }),
    filteredConversations = conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    submitMessage = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!(selectedId && (composerText.trim() || attachments.length > 0))) {
        return;
      }

      sendMessage.mutate(
        {
          attachments,
          body: composerText.trim(),
        },
        {
          onSuccess: () => {
            setComposerText("");
            setAttachments([]);
          },
        }
      );
    },
    handleStartChatWithFriend = (friend: FriendSummary) => {
      const existing = conversations.find(
        (c) =>
          c.title.toLowerCase().includes(friend.name.toLowerCase()) ||
          (friend.username &&
            c.title.toLowerCase().includes(friend.username.toLowerCase()))
      );

      if (existing) {
        setSelectedId(existing.id);
      } else {
        setTargetFriendId(friend.id);
        setIsNewChatOpen(true);
      }
    };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold tracking-tight">
            Messages
          </h1>
          <p className="mt-1 text-muted-foreground">
            Chat with your friends and music collaborators
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="bg-card/40 border-border/40"
          >
            <Link to="/dashboard/collaborators">
              <UserRoundPlus className="mr-2 size-3.5" />
              Friends &amp; Collaborators
            </Link>
          </Button>
          <Button
            className="shadow-lg shadow-primary/20"
            onClick={() => {
              setTargetFriendId(undefined);
              setIsNewChatOpen(true);
            }}
            size="sm"
          >
            <Plus className="mr-2 size-3.5" />
            New Chat
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <Card className="flex h-full w-full flex-col overflow-hidden border-border/40 bg-card/40 backdrop-blur-md md:w-80 shrink-0">
          {/* Search bar */}
          <div className="border-b border-border/20 p-3">
            <div className="relative">
              <Search className="-translate-y-1/2 absolute left-3 top-1/2 size-4 text-muted-foreground" />
              <Input
                className="border-none bg-muted/30 pl-9 text-xs focus-visible:ring-1 focus-visible:ring-primary/30"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search chats..."
                value={searchQuery}
              />
            </div>
          </div>

          {/* Quick Active Friends & Collaborators Bar */}
          {messageableFriends.length > 0 && (
            <div className="border-b border-border/20 p-3 bg-muted/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Friends Online
                </span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {messageableFriends.length} active
                </span>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1 custom-scrollbar">
                {messageableFriends.map((friend) => (
                  <button
                    key={friend.id}
                    className="flex flex-col items-center gap-1 shrink-0 group text-center focus:outline-none"
                    onClick={() => handleStartChatWithFriend(friend)}
                    type="button"
                    title={`Chat with ${friend.name}`}
                  >
                    <div className="relative">
                      <Avatar className="size-10 border-2 border-border/40 group-hover:border-primary/50 transition-all">
                        <AvatarImage src={friend.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {initials(friend.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background shadow-sm" />
                    </div>
                    <span className="text-[10px] truncate max-w-[54px] text-muted-foreground group-hover:text-foreground">
                      {friend.name.split(" ")[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversations List */}
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
                    Start a new chat with a friend or collaborator above.
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

        {/* Chat area */}
        <Card className="hidden flex-1 flex-col overflow-hidden border-border/40 bg-card/20 backdrop-blur-xl md:flex">
          {selectedConversation ? (
            <>
              <div className="flex items-center justify-between border-b border-border/20 bg-white/[0.02] p-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="size-10 border-2 border-border/40">
                      <AvatarFallback>
                        {initials(selectedConversation.title)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm leading-none">
                      {selectedConversation.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge
                        className="capitalize text-[10px] px-1.5 py-0"
                        variant="secondary"
                      >
                        {selectedConversation.conversationType}
                      </Badge>
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                        Active now
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setIsCollaborationOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  <FolderKanban className="mr-2 size-4" />
                  Start Collaboration
                </Button>
              </div>

              <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-6">
                {messagesQuery.isLoading && (
                  <p className="text-sm text-muted-foreground">
                    Loading messages...
                  </p>
                )}
                {(messagesQuery.data ?? []).map((message) => (
                  <div className="flex justify-start" key={message.id}>
                    <div className="max-w-[75%] rounded-2xl rounded-bl-none border border-border/20 bg-muted/80 px-4 py-3 text-sm shadow-sm">
                      {message.body ? (
                        <p className="whitespace-pre-wrap">{message.body}</p>
                      ) : null}
                      {message.attachments?.map((attachment) => (
                        <a
                          className="mt-2 block rounded-lg border bg-background/60 p-2 text-xs hover:border-primary"
                          href={attachment.url}
                          key={attachment.id}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <Paperclip className="mr-1 inline size-3" />
                          {attachment.displayName}
                        </a>
                      ))}
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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
                        Send the first message to start this chat.
                      </p>
                    </div>
                  )}
              </div>

              <form
                className="border-t border-border/20 bg-white/[0.01] p-4"
                onSubmit={submitMessage}
              >
                {attachments.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {attachments.map((attachment) => (
                      <Badge
                        className="gap-1 text-xs"
                        key={attachment.url}
                        variant="secondary"
                      >
                        <Paperclip className="size-3" />
                        {attachment.displayName}
                        <button
                          aria-label={`Remove attachment ${attachment.displayName}`}
                          onClick={() =>
                            setAttachments((current) =>
                              current.filter(
                                (item) => item.url !== attachment.url
                              )
                            )
                          }
                          type="button"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-center gap-2 rounded-2xl border border-border/20 bg-muted/40 p-1.5 pl-3 backdrop-blur-xl transition-all focus-within:ring-1 focus-within:ring-primary/20">
                  <Input
                    className="h-10 border-none bg-transparent px-1 text-sm focus-visible:ring-0"
                    onChange={(event) => setComposerText(event.target.value)}
                    placeholder="Type your message..."
                    value={composerText}
                  />
                  <label
                    className="inline-flex size-10 cursor-pointer items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
                    title="Upload file attachment"
                  >
                    <Paperclip className="size-4" />
                    <input
                      className="hidden"
                      disabled={isUploading}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          upload([file]);
                        }
                      }}
                      type="file"
                    />
                  </label>
                  <Button
                    className="size-10 shrink-0 rounded-xl shadow-lg shadow-primary/20"
                    disabled={
                      (!composerText.trim() && attachments.length === 0) ||
                      sendMessage.isPending ||
                      isUploading
                    }
                    size="icon"
                    type="submit"
                  >
                    {sendMessage.isPending || isUploading ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Attach music from library:</span>
                  {(savedTracksQuery.data ?? []).slice(0, 3).map((track) => (
                    <button
                      className="underline hover:text-foreground"
                      key={track.id}
                      onClick={() =>
                        setAttachments((current) => [
                          ...current,
                          {
                            displayName: track.title,
                            sourceTrackId: track.id,
                            url: track.streamUrl,
                          },
                        ])
                      }
                      type="button"
                    >
                      +{track.title}
                    </button>
                  ))}
                  {(purchasesQuery.data ?? []).slice(0, 2).map((purchase) =>
                    purchase.track ? (
                      <button
                        className="underline hover:text-foreground"
                        key={purchase.id}
                        onClick={() =>
                          setAttachments((current) => [
                            ...current,
                            {
                              displayName:
                                purchase.track?.title ?? "Purchased track",
                              sourceTrackId: purchase.trackId ?? undefined,
                              url: purchase.track?.audioMasterUrl ?? "",
                            },
                          ])
                        }
                        type="button"
                      >
                        +{purchase.track.title}
                      </button>
                    ) : null
                  )}
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <MessageSquare className="mx-auto mb-3 size-10 text-muted-foreground/30" />
                <p className="font-medium">Select or start a conversation</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a friend from the left or click New Chat to start
                  messaging.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <CollaborationDialog
        conversationId={selectedId}
        open={isCollaborationOpen}
        onOpenChange={setIsCollaborationOpen}
      />
      <NewChatDialog
        initialFriendId={targetFriendId}
        onOpenChange={setIsNewChatOpen}
        onConversationCreated={(id) => setSelectedId(id)}
        open={isNewChatOpen}
      />
    </div>
  );
}

function CollaborationDialog({
  conversationId,
  onOpenChange,
  open,
}: {
  conversationId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [kind, setKind] = useState<"project" | "track">("track"),
    [title, setTitle] = useState(""),
    [isCreating, setIsCreating] = useState(false),
    createCollaboration = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsCreating(true);
      try {
        const response = await fetch(
          `${API_V1_URL}/messages/conversations/${encodeURIComponent(conversationId)}/collaborations`,
          {
            body: JSON.stringify({ kind, title }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }
        );
        if (!response.ok) {
          throw new Error("Could not start the collaboration.");
        }
        const result = (await response.json()) as { href: string };
        window.location.assign(result.href);
      } finally {
        setIsCreating(false);
      }
    };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a Shared Music Workspace</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={createCollaboration}>
          <div className="space-y-2">
            <Label htmlFor="collaboration-title">Working title</Label>
            <Input
              id="collaboration-title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled collaboration"
              required
              value={title}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collaboration-kind">Workspace type</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              id="collaboration-kind"
              onChange={(event) =>
                setKind(event.target.value === "project" ? "project" : "track")
              }
              value={kind}
            >
              <option value="track">Shared track</option>
              <option value="project">Shared project</option>
            </select>
          </div>
          <Button
            className="w-full"
            disabled={isCreating || !title.trim()}
            type="submit"
          >
            {isCreating ? "Creating…" : "Create Shared Workspace"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewChatDialog({
  initialFriendId,
  onConversationCreated,
  onOpenChange,
  open,
}: {
  initialFriendId?: string;
  onConversationCreated?: (id: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const friendsQuery = useFriendsQuery(),
    startConversation = useStartConversationMutation(),
    [selectedFriends, setSelectedFriends] = useState<FriendSummary[]>([]),
    [message, setMessage] = useState(""),
    [search, setSearch] = useState(""),
    peopleSearchQuery = usePeopleSearchQuery(search),
    friends = useMemo(
      () => (Array.isArray(friendsQuery.data) ? friendsQuery.data : []),
      [friendsQuery.data]
    );

  // Preselect initialFriendId when dialog opens
  useEffect(() => {
    if (open && initialFriendId && friends.length > 0) {
      const match = friends.find((f) => f.id === initialFriendId);
      if (match) {
        setSelectedFriends((current) =>
          current.some((f) => f.id === match.id) ? current : [...current, match]
        );
      }
    }
  }, [open, initialFriendId, friends]);

  const normalizedSearch = search.trim().replace(/^@/, "").toLowerCase(),
    // Combine local friends with database search results
    allCandidates = useMemo(() => {
      const candidatesMap = new Map<string, FriendSummary>();

      // 1. Add all local friends/collaborators/following/fans
      for (const friend of friends) {
        candidatesMap.set(friend.id, friend);
      }

      // 2. Merge in database search results
      if (Array.isArray(peopleSearchQuery.data)) {
        for (const person of peopleSearchQuery.data) {
          if (!candidatesMap.has(person.userId)) {
            candidatesMap.set(person.userId, {
              avatarUrl: person.avatarUrl,
              email: person.email,
              id: person.userId,
              lastInteractionAt: null,
              name: person.displayName,
              relationship: "user",
              role: person.stageName ? "Artist" : "User",
              username: person.username,
            });
          }
        }
      }

      return [...candidatesMap.values()];
    }, [friends, peopleSearchQuery.data]),
    selectedIds = useMemo(
      () => new Set(selectedFriends.map((f) => f.id)),
      [selectedFriends]
    ),
    // Filter candidates based on search query and exclude already selected
    filteredCandidates = useMemo(
      () =>
        allCandidates
          .filter((candidate) => !selectedIds.has(candidate.id))
          .filter((candidate) => {
            if (!normalizedSearch) {return true;}
            return [
              candidate.name,
              candidate.username,
              candidate.email,
              candidate.role,
            ]
              .filter(Boolean)
              .some((val) => val?.toLowerCase().includes(normalizedSearch));
          }),
      [allCandidates, selectedIds, normalizedSearch]
    ),
    isGroupChat = selectedFriends.length > 1,
    startChat = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (selectedFriends.length === 0) {
        return;
      }

      startConversation.mutate(
        {
          conversation: {
            participantUserIds: selectedFriends.map((friend) => friend.id),
            title: isGroupChat
              ? selectedFriends.map((friend) => friend.name).join(", ")
              : undefined,
          },
          message: message.trim() ? { body: message.trim() } : undefined,
        },
        {
          onSuccess: (res) => {
            setMessage("");
            setSearch("");
            setSelectedFriends([]);
            onOpenChange(false);
            if (res?.id && onConversationCreated) {
              onConversationCreated(res.id);
            }
          },
        }
      );
    };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-base">
            <span>
              {isGroupChat
                ? `New Group Chat (${selectedFriends.length})`
                : "New Chat"}
            </span>
            {isGroupChat && (
              <Badge
                variant="secondary"
                className="text-xs bg-primary/20 text-primary"
              >
                Group Chat
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={startChat}>
          <div className="space-y-2">
            <div className="relative">
              <Input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, @username, or email..."
                value={search}
                className="pr-8"
              />
              {peopleSearchQuery.isFetching && (
                <LoaderCircle className="absolute right-2.5 top-2.5 size-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {selectedFriends.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-muted/30 border">
                <span className="text-[11px] font-medium text-muted-foreground mr-1">
                  To:
                </span>
                {selectedFriends.map((friend) => (
                  <Badge
                    className="gap-1 text-xs py-1"
                    key={friend.id}
                    variant="secondary"
                  >
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
            )}
          </div>

          <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border/40 p-2">
            {filteredCandidates.map((candidate) => (
              <button
                className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted transition-colors group"
                key={candidate.id}
                onClick={() =>
                  setSelectedFriends((current) => [...current, candidate])
                }
                type="button"
              >
                <div className="relative">
                  <Avatar className="size-8">
                    <AvatarImage src={candidate.avatarUrl ?? undefined} />
                    <AvatarFallback>{initials(candidate.name)}</AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-1 ring-background" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">
                    {candidate.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {candidate.username
                      ? `@${candidate.username}`
                      : candidate.email}
                  </p>
                </div>
                {candidate.relationship === "collaborator" ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-violet-400 border-violet-500/30"
                  >
                    Collaborator
                  </Badge>
                ) : candidate.relationship === "friend" ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-emerald-400 border-emerald-500/30"
                  >
                    Friend
                  </Badge>
                ) : candidate.relationship === "following" ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-sky-400 border-sky-500/30"
                  >
                    Following
                  </Badge>
                ) : candidate.relationship === "fan" ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-amber-400 border-amber-500/30"
                  >
                    Fan
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-muted-foreground"
                  >
                    {candidate.role ?? "User"}
                  </Badge>
                )}
              </button>
            ))}
            {filteredCandidates.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">
                {search.trim().length > 0
                  ? `No users found matching "${search}".`
                  : (selectedFriends.length > 0
                    ? "Type above to search and add more participants."
                    : "Search users by name, username, or email to start a conversation.")}
              </div>
            )}
          </div>

          <Textarea
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Type a message (optional)..."
            value={message}
            className="min-h-[80px]"
          />

          <div className="flex items-center justify-between gap-3">
            <Button asChild={true} type="button" variant="outline" size="sm">
              <Link to="/dashboard/collaborators">Manage Friends</Link>
            </Button>
            <Button
              disabled={
                selectedFriends.length === 0 || startConversation.isPending
              }
              type="submit"
            >
              {startConversation.isPending && (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              )}
              {isGroupChat
                ? `Start Group Chat (${selectedFriends.length})`
                : "Start Chat"}
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
      <div className="relative">
        <Avatar className="size-11 border-2 border-border/10 transition-colors group-hover:border-primary/20">
          <AvatarFallback className="bg-muted text-xs">
            {initials(conversation.title)}
          </AvatarFallback>
        </Avatar>
        <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
      </div>
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
