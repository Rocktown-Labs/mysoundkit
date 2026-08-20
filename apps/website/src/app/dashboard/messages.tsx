"use client";
/* eslint-disable one-var, sort-vars, complexity, require-unicode-regexp, no-nested-ternary, unicorn/no-nested-ternary */

import { useUploadFiles } from "@better-upload/client";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Clock,
  ExternalLink,
  FolderKanban,
  LoaderCircle,
  MessageSquare,
  Music,
  Paperclip,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Terminal,
  UserRoundPlus,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import type { PlayerTrack } from "@/components/audio-player-provider";
import { useAudioPlayer } from "@/components/audio-player-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@soundkit/ui/components/message-scroller";
import { Textarea } from "@/components/ui/textarea";
import { useMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";
import { API_V1_URL, MEDIA_BASE_URL, MEDIA_UPLOAD_URL } from "@/lib/api";
import {
  useCreateMessageCollectionMutation,
  useMessagingConversations,
  useMessagingMessages,
} from "@/lib/message-db";
import { usePresence } from "@/lib/presence-context";
import {
  useFriendsQuery,
  useLibrarySavedQuery,
  useMeQuery,
  usePeopleSearchQuery,
  useStartConversationMutation,
  useTracksQuery,
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
      .toUpperCase(),
  SLASH_COMMANDS = [
    {
      command: "/collab",
      description: "Send a shared draft project proposal with 24h expiration",
      example: "/collab",
      label: "Start Collaboration",
    },
    {
      command: "/share",
      description: "Attach and share playable tracks or kits from your library",
      example: "/share",
      label: "Share Music",
    },
    {
      command: "/help",
      description: "Display SoundKit chat commands and shortcuts",
      example: "/help",
      label: "Chat Help",
    },
  ];

function MessagesPage() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated ? <MessagesPageClient /> : null;
}

function MessagesPageClient() {
  const searchParams = Route.useSearch(),
    isMobile = useMobile(),
    { isUserOnline, registerPresenceUsers } = usePresence(),
    meQuery = useMeQuery(),
    conversationsQuery = useMessagingConversations(),
    friendsQuery = useFriendsQuery(),
    uploadedTracksQuery = useTracksQuery(),
    savedTracksQuery = useLibrarySavedQuery(),
    {
      currentTrack,
      isPlaying,
      setCurrentTrack,
      setIsPlaying,
      setQueue,
      setVisible,
    } = useAudioPlayer(),
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
    onlineFriends = useMemo(
      () => messageableFriends.filter((f) => isUserOnline(f.id)),
      [isUserOnline, messageableFriends]
    ),
    [selectedId, setSelectedId] = useState(""),
    [searchQuery, setSearchQuery] = useState(""),
    [attachments, setAttachments] = useState<
      {
        displayName: string;
        mimeType?: string;
        objectKey?: string;
        sizeBytes?: number;
        sourceProjectId?: string;
        sourceTrackId?: string;
        url: string;
      }[]
    >([]),
    [composerText, setComposerText] = useState(""),
    [showMusicPicker, setShowMusicPicker] = useState(false),
    [musicPickerTab, setMusicPickerTab] = useState<
      "uploads" | "saved" | "search"
    >("uploads"),
    [musicSearchQuery, setMusicSearchQuery] = useState(""),
    [showInlineCollab, setShowInlineCollab] = useState(false),
    [collabTitle, setCollabTitle] = useState(""),
    [collabProjectType, setCollabProjectType] = useState<
      "album" | "ep" | "single"
    >("single"),
    [isCollaborationOpen, setIsCollaborationOpen] = useState(false),
    [isShareMediaOpen, setIsShareMediaOpen] = useState(false),
    [isHelpOpen, setIsHelpOpen] = useState(false),
    [isNewChatOpen, setIsNewChatOpen] = useState(false),
    [targetFriendId, setTargetFriendId] = useState<string | undefined>();

  useEffect(
    () =>
      registerPresenceUsers([
        ...messageableFriends.map((friend) => friend.id),
        ...conversations.flatMap((conversation) =>
          conversation.participantId ? [conversation.participantId] : []
        ),
      ]),
    [conversations, messageableFriends, registerPresenceUsers]
  );

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
                  .includes(targetFriend.username.toLowerCase())) ||
              c.participantId === targetFriend.id)
        );

      if (existing) {
        setSelectedId(existing.id);
      } else {
        setTargetFriendId(searchParams.friendId);
        setIsNewChatOpen(true);
      }
      return;
    }

    if (!selectedId && !isMobile && conversations[0]) {
      setSelectedId(conversations[0].id);
    }
  }, [
    conversations,
    friends,
    isMobile,
    searchParams.conversationId,
    searchParams.friendId,
    selectedId,
  ]);

  const selectedConversation = conversations.find(
      (conversation) => conversation.id === selectedId
    ),
    messagesQuery = useMessagingMessages(selectedId),
    sendMessage = useCreateMessageCollectionMutation(
      selectedId,
      meQuery.data?.user.id
    ),
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
      route: "media",
    }),
    filteredConversations = conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    isSlashActive = composerText.startsWith("/"),
    matchingCommands = isSlashActive
      ? SLASH_COMMANDS.filter((cmd) =>
          cmd.command
            .toLowerCase()
            .startsWith(composerText.split(" ")[0].toLowerCase())
        )
      : [],
    handleRespondCollaboration = async (
      projectId: string,
      action: "accept" | "decline" | "cancel"
    ) => {
      try {
        const response = await fetch(
          `${API_V1_URL}/messages/conversations/${encodeURIComponent(selectedId)}/collaborations/${encodeURIComponent(projectId)}/respond`,
          {
            body: JSON.stringify({ action }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }
        );
        if (!response.ok) {
          throw new Error("Could not update status.");
        }
        toast({
          description:
            action === "accept"
              ? "Collaboration accepted! Workspace unlocked."
              : action === "decline"
                ? "Collaboration declined."
                : "Collaboration cancelled.",
          title: "Status Updated",
        });
        messagesQuery.refetch();
      } catch {
        toast({
          description: "Failed to respond to collaboration.",
          title: "Error",
          variant: "destructive",
        });
      }
    },
    handleSendCollabProposal = async ({
      projectType,
      title,
    }: {
      projectType: "album" | "ep" | "single";
      title: string;
    }) => {
      if (!selectedId) {
        return;
      }
      try {
        const response = await fetch(
          `${API_V1_URL}/messages/conversations/${encodeURIComponent(selectedId)}/collaborations`,
          {
            body: JSON.stringify({
              initialTracks: [],
              isProjectLevel: true,
              kind: "project",
              projectType,
              title,
            }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }
        );
        if (!response.ok) {
          throw new Error("Failed to send collaboration invite.");
        }
        toast({
          description: `Invitation sent for "${title}".`,
          title: "Collab proposal sent",
        });
        messagesQuery.refetch();
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not send collaboration.",
          title: "Failed to send proposal",
          variant: "destructive",
        });
      }
    },
    handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const rawText = composerText.trim();

      if (rawText === "/collab" || rawText.startsWith("/collab ")) {
        const title = rawText.replace(/^\/collab\s*/iu, "").trim();
        setCollabTitle(title || "Collaboration Project");
        setShowInlineCollab(true);
        setShowMusicPicker(false);
        setComposerText("");
        return;
      }

      if (rawText === "/share") {
        setShowMusicPicker(true);
        setShowInlineCollab(false);
        setComposerText("");
        return;
      }

      if (rawText.startsWith("/share ") && attachments.length === 0) {
        const remaining = rawText.replace(/^\/share\s*/iu, "").trim();
        setComposerText(remaining);
        setShowMusicPicker(true);
        setShowInlineCollab(false);
        return;
      }

      if (rawText === "/help") {
        setIsHelpOpen(true);
        setComposerText("");
        return;
      }

      const body = rawText.replace(/^\/share\s*/iu, "").trim();

      if (!body && attachments.length === 0) {
        return;
      }

      sendMessage.mutate(
        {
          attachments,
          body,
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
            c.title.toLowerCase().includes(friend.username.toLowerCase())) ||
          c.participantId === friend.id
      );

      if (existing) {
        setSelectedId(existing.id);
        return;
      }

      setTargetFriendId(friend.id);
      setIsNewChatOpen(true);
    };

  const isSelectedConvoOnline = selectedConversation?.participantId
    ? isUserOnline(selectedConversation.participantId)
    : false;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-4 p-4 md:p-6">
      {/* Sidebar - conversations & contacts */}
      <Card
        className={cn(
          "flex-col overflow-hidden border-border/40 bg-card/20 backdrop-blur-xl md:w-80 lg:w-96",
          selectedId ? "hidden md:flex" : "flex w-full"
        )}
      >
        <div className="border-b border-border/20 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg tracking-tight">Messages</h2>
              <p className="text-xs text-muted-foreground">
                Collaborate and chat with artists
              </p>
            </div>
            <Button
              className="size-8 rounded-full"
              onClick={() => setIsNewChatOpen(true)}
              size="icon"
              variant="outline"
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <Input
              className="h-9 bg-background/50 pl-9 text-xs"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              value={searchQuery}
            />
          </div>
        </div>

        {/* Online friends horizontal scroll */}
        {onlineFriends.length > 0 && (
          <div className="border-b border-border/20 p-3">
            <p className="mb-2 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
              Online Now ({onlineFriends.length})
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
              {onlineFriends.map((friend) => (
                <button
                  className="group flex flex-col items-center gap-1 shrink-0"
                  key={friend.id}
                  onClick={() => handleStartChatWithFriend(friend)}
                  type="button"
                >
                  <div className="relative">
                    <Avatar className="size-10 border-2 border-border/40 transition-transform group-hover:scale-105">
                      <AvatarImage src={friend.avatarUrl ?? undefined} />
                      <AvatarFallback>{initials(friend.name)}</AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                  </div>
                  <span className="max-w-[48px] truncate text-[10px] text-muted-foreground group-hover:text-foreground">
                    {friend.name.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversations list */}
        <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-2">
          {filteredConversations.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No conversations found
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
      <Card
        className={cn(
          "flex-1 flex-col overflow-hidden border-border/40 bg-card/20 backdrop-blur-xl",
          selectedId ? "flex" : "hidden md:flex"
        )}
      >
        {selectedConversation ? (
          <>
            <div className="flex items-center justify-between border-b border-border/20 bg-white/[0.02] p-4">
              <div className="flex items-center gap-3">
                <Button
                  className="size-9 shrink-0 rounded-full md:hidden"
                  onClick={() => setSelectedId("")}
                  size="icon"
                  variant="ghost"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="size-5" />
                </Button>
                <div className="relative">
                  <Avatar className="size-10 border-2 border-border/40">
                    <AvatarImage
                      src={
                        selectedConversation.participantAvatarUrl ?? undefined
                      }
                    />
                    <AvatarFallback>
                      {initials(
                        selectedConversation.participantName ||
                          selectedConversation.title ||
                          "Direct"
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-background",
                      isSelectedConvoOnline
                        ? "bg-emerald-500 shadow-sm animate-pulse"
                        : "bg-muted-foreground/30"
                    )}
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-sm leading-none">
                    {selectedConversation.participantName ||
                      (selectedConversation.title === "Untitled conversation"
                        ? "Direct Message"
                        : selectedConversation.title)}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge
                      className="capitalize text-[10px] px-1.5 py-0"
                      variant="secondary"
                    >
                      {selectedConversation.conversationType}
                    </Badge>
                    <span
                      className={cn(
                        "text-[11px] font-medium flex items-center gap-1",
                        isSelectedConvoOnline
                          ? "text-emerald-400 font-semibold"
                          : "text-muted-foreground"
                      )}
                    >
                      {isSelectedConvoOnline ? "Active now" : "Offline"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsShareMediaOpen(true)}
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1.5"
                >
                  <Music className="size-3.5" />
                  Share Music
                </Button>
                <Button
                  onClick={() => setIsCollaborationOpen(true)}
                  size="sm"
                  variant="default"
                  className="text-xs gap-1.5 bg-primary"
                >
                  <FolderKanban className="size-3.5" />
                  Start Collaboration
                </Button>
              </div>
            </div>

            <MessageScrollerProvider
              autoScroll
              defaultScrollPosition="end"
              scrollPreviousItemPeek={64}
            >
              <MessageScroller>
                <MessageScrollerViewport>
                  <MessageScrollerContent className="gap-4 p-6">
                    {messagesQuery.isLoading && (
                      <MessageScrollerItem messageId="loading-messages">
                        <p className="text-sm text-muted-foreground">
                          Loading messages...
                        </p>
                      </MessageScrollerItem>
                    )}
              {(messagesQuery.data ?? []).map((message) => {
                const isMine = message.senderId === meQuery.data?.user.id;
                const hasCollabProposal = message.attachments?.some(
                  (att) =>
                    att.mimeType === "soundkit/collaboration-proposal" ||
                    Boolean(att.sourceProjectId)
                );
                const collabAtt = message.attachments?.find(
                  (att) =>
                    att.mimeType === "soundkit/collaboration-proposal" ||
                    Boolean(att.sourceProjectId)
                );

                return (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={isMine}
                  >
                    <div
                      className={cn(
                        "flex",
                        isMine ? "justify-end" : "justify-start"
                      )}
                    >
                    {hasCollabProposal && collabAtt ? (
                      <div className="w-full max-w-sm rounded-2xl border-2 border-primary/40 bg-card/95 p-4 shadow-xl space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-2 font-bold text-primary text-sm">
                            <FolderKanban className="size-4.5" />
                            <span>Shared Collaboration Proposal</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            Draft
                          </Badge>
                        </div>
                        <div>
                          <p className="font-bold text-base text-foreground">
                            {collabAtt.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                            <Clock className="size-3.5 text-amber-400" />
                            24-Hour Acceptance Window
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 pt-1">
                          {isMine ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground hover:text-destructive w-full"
                              onClick={() =>
                                handleRespondCollaboration(
                                  collabAtt.sourceProjectId ?? "",
                                  "cancel"
                                )
                              }
                            >
                              Cancel Invitation
                            </Button>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                size="sm"
                                className="h-8 text-xs gap-1 bg-primary"
                                onClick={() =>
                                  handleRespondCollaboration(
                                    collabAtt.sourceProjectId ?? "",
                                    "accept"
                                  )
                                }
                              >
                                <Check className="size-3.5" />
                                Accept Collaboration
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() =>
                                  handleRespondCollaboration(
                                    collabAtt.sourceProjectId ?? "",
                                    "decline"
                                  )
                                }
                              >
                                Decline
                              </Button>
                            </div>
                          )}
                          {collabAtt.url && (
                            <Button
                              asChild
                              size="sm"
                              variant="secondary"
                              className="h-8 text-xs w-full gap-1.5"
                            >
                              <a
                                href={collabAtt.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="size-3.5" />
                                Open Project Workspace
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm border",
                          isMine
                            ? "bg-primary text-primary-foreground border-primary/30 rounded-br-none"
                            : "bg-muted/80 text-foreground border-border/20 rounded-bl-none"
                        )}
                      >
                        {message.body ? (
                          <p className="whitespace-pre-wrap">{message.body}</p>
                        ) : null}

                        {/* Attachments */}
                        {message.attachments?.map((attachment, idx) => {
                          const isAudio =
                            attachment.mimeType?.startsWith("audio/") ||
                            Boolean(attachment.sourceTrackId);

                          return isAudio ? (
                            <div
                              key={attachment.id ?? idx}
                              className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-background/20 p-2.5 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="size-7 rounded-full shrink-0"
                                  onClick={() => {
                                    const trackId =
                                      attachment.sourceTrackId ??
                                      attachment.id ??
                                      `shared_${idx}`;
                                    if (
                                      isPlaying &&
                                      currentTrack?.id === trackId
                                    ) {
                                      setIsPlaying(false);
                                    } else if (currentTrack?.id === trackId) {
                                      setIsPlaying(true);
                                    } else {
                                      const playerTrack: PlayerTrack = {
                                        artist: "Shared Track",
                                        cover: "/night-music-album-cover.png",
                                        id: trackId,
                                        src: attachment.url,
                                        title: attachment.displayName,
                                        trackHref: attachment.sourceTrackId
                                          ? `/tracks/${attachment.sourceTrackId}`
                                          : undefined,
                                      };
                                      setQueue([playerTrack]);
                                      setCurrentTrack(playerTrack);
                                      setIsPlaying(true);
                                      setVisible(true);
                                    }
                                  }}
                                >
                                  {isPlaying &&
                                  currentTrack?.id ===
                                    (attachment.sourceTrackId ??
                                      attachment.id ??
                                      `shared_${idx}`) ? (
                                    <Pause className="size-3.5 fill-current" />
                                  ) : (
                                    <Play className="size-3.5 fill-current ml-0.5" />
                                  )}
                                </Button>
                                <div className="truncate">
                                  <p className="font-bold truncate">
                                    {attachment.displayName}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground opacity-80">
                                    SoundKit Audio Preview
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : (
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
                          );
                        })}

                        <p
                          className={cn(
                            "mt-2 font-mono text-[10px]",
                            isMine
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    )}
                    </div>
                  </MessageScrollerItem>
                );
              })}
              {!messagesQuery.isLoading &&
                (messagesQuery.data ?? []).length === 0 && (
                  <MessageScrollerItem messageId="empty-messages">
                    <div className="py-12 text-center">
                    <MessageSquare className="mx-auto mb-3 size-8 text-muted-foreground/30" />
                    <p className="font-medium">No messages yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Send the first message to start this chat.
                    </p>
                    </div>
                  </MessageScrollerItem>
                )}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>

            <form
              className="border-t border-border/20 bg-white/[0.01] p-4"
              onSubmit={handleSendMessage}
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

              {/* Slash Command Helper Popup */}
              {isSlashActive && matchingCommands.length > 0 && (
                <div className="mb-2 rounded-xl border bg-popover/95 p-2 shadow-2xl backdrop-blur-md z-50 text-xs space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
                  <div className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                    <Terminal className="size-3 text-primary" />
                    Slash Commands
                  </div>
                  {matchingCommands.map((cmd) => (
                    <button
                      key={cmd.command}
                      type="button"
                      onClick={() => {
                        if (cmd.command === "/collab") {
                          setShowInlineCollab(true);
                          setShowMusicPicker(false);
                          setComposerText("");
                        } else if (cmd.command === "/share") {
                          setShowMusicPicker(true);
                          setShowInlineCollab(false);
                          setComposerText((curr) =>
                            curr.replace(/^\/share\s*/iu, "").trim()
                          );
                        } else if (cmd.command === "/help") {
                          setIsHelpOpen(true);
                          setComposerText("");
                        }
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-muted transition flex flex-col gap-0.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-primary">
                          {cmd.command}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {cmd.label}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {cmd.description}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Inline Collab Proposal Popover */}
              {showInlineCollab && (
                <div className="mb-2 p-3 bg-card border rounded-xl shadow-2xl z-50 text-xs space-y-2.5 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <span className="font-bold flex items-center gap-1.5 text-primary">
                      <FolderKanban className="size-3.5" />
                      Send Collaboration Proposal
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-5 rounded-full"
                      onClick={() => setShowInlineCollab(false)}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Project Title
                      </Label>
                      <Input
                        value={collabTitle}
                        onChange={(e) => setCollabTitle(e.target.value)}
                        placeholder="e.g. Summer Anthem EP"
                        className="h-8 text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Type
                      </Label>
                      <div className="grid grid-cols-3 gap-1 mt-0.5">
                        {(["single", "ep", "album"] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setCollabProjectType(type)}
                            className={cn(
                              "py-1 px-2 text-[10px] font-bold rounded-md border text-center uppercase transition cursor-pointer",
                              collabProjectType === type
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/40 hover:bg-muted text-muted-foreground"
                            )}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={!collabTitle.trim()}
                      onClick={async () => {
                        await handleSendCollabProposal({
                          projectType: collabProjectType,
                          title: collabTitle.trim() || "Collaboration Project",
                        });
                        setShowInlineCollab(false);
                        setCollabTitle("");
                      }}
                      className="w-full h-8 text-xs bg-primary gap-1"
                    >
                      <Check className="size-3" />
                      Send Collab Proposal
                    </Button>
                  </div>
                </div>
              )}

              {/* Tabbed Music Library & Platform Search Attachment Selector Popup */}
              {showMusicPicker && (
                <div className="mb-2 p-3 bg-card border rounded-xl shadow-2xl z-50 text-xs space-y-2 max-h-64 overflow-y-auto">
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <span className="font-bold flex items-center gap-1.5 text-primary">
                      <Music className="size-3.5" />
                      Share Track
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-5 rounded-full"
                      onClick={() => setShowMusicPicker(false)}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>

                  {/* Tabs */}
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        ["uploads", "Uploads"],
                        ["saved", "Saved"],
                        ["search", "Explore"],
                      ] as const
                    ).map(([tabKey, tabLabel]) => (
                      <button
                        key={tabKey}
                        type="button"
                        onClick={() => setMusicPickerTab(tabKey)}
                        className={cn(
                          "py-1 text-[10px] font-bold rounded-md border text-center transition cursor-pointer",
                          musicPickerTab === tabKey
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/40 hover:bg-muted text-muted-foreground"
                        )}
                      >
                        {tabLabel}
                      </button>
                    ))}
                  </div>

                  {/* Search input */}
                  <div className="relative">
                    <Input
                      value={musicSearchQuery}
                      onChange={(e) => setMusicSearchQuery(e.target.value)}
                      placeholder="Filter tracks..."
                      className="h-8 text-xs pl-7"
                    />
                    <Search className="size-3 text-muted-foreground absolute left-2 top-2.5" />
                  </div>

                  {/* Track List */}
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {(() => {
                      const allTracks =
                        musicPickerTab === "uploads"
                          ? (uploadedTracksQuery.data ?? [])
                          : musicPickerTab === "saved"
                            ? (savedTracksQuery.data ?? [])
                            : [
                                ...(uploadedTracksQuery.data ?? []),
                                ...(savedTracksQuery.data ?? []),
                              ];
                      const q = musicSearchQuery.trim().toLowerCase();
                      const filtered = allTracks.filter((t) =>
                        q ? t.title.toLowerCase().includes(q) : true
                      );

                      if (filtered.length === 0) {
                        return (
                          <p className="text-[11px] text-muted-foreground text-center py-3">
                            No matching tracks found.
                          </p>
                        );
                      }

                      return filtered.slice(0, 10).map((track) => (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() => {
                            setAttachments((curr) => [
                              ...curr,
                              {
                                displayName: track.title,
                                sourceTrackId: track.id,
                                url:
                                  ("playbackUrl" in track
                                    ? track.playbackUrl
                                    : undefined) ||
                                  ("downloadUrl" in track
                                    ? track.downloadUrl
                                    : undefined) ||
                                  `/tracks/${track.id}`,
                              },
                            ]);
                            setShowMusicPicker(false);
                            setMusicSearchQuery("");
                          }}
                          className="w-full text-left p-1.5 rounded-lg hover:bg-muted flex items-center justify-between transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Music className="size-3 text-primary shrink-0" />
                            <span className="font-medium truncate max-w-[200px]">
                              {track.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-primary font-bold">
                            Attach
                          </span>
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 rounded-2xl border border-border/20 bg-muted/40 p-1.5 pl-3 backdrop-blur-xl transition-all focus-within:ring-1 focus-within:ring-primary/20">
                <Input
                  className="h-10 border-none bg-transparent px-1 text-sm focus-visible:ring-0"
                  onChange={(event) => setComposerText(event.target.value)}
                  placeholder="Type a message or /collab..."
                  value={composerText}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-10 rounded-xl"
                  onClick={() => setShowMusicPicker((prev) => !prev)}
                  title="Share music from library (/share)"
                >
                  <Music className="size-4" />
                </Button>
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
            </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <MessageSquare className="mb-4 size-12 text-muted-foreground/30" />
            <h3 className="font-semibold text-lg">No conversation selected</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Choose a conversation from the sidebar or start a new chat with an
              artist or collaborator.
            </p>
            <Button
              className="mt-4"
              onClick={() => setIsNewChatOpen(true)}
              size="sm"
            >
              <UserRoundPlus className="mr-2 size-4" />
              Start New Chat
            </Button>
          </div>
        )}
      </Card>

      {/* Collaboration Dialog */}
      <CollaborationDialog
        conversationId={selectedId}
        onOpenChange={setIsCollaborationOpen}
        onSuccess={() => {
          messagesQuery.refetch();
        }}
        open={isCollaborationOpen}
      />

      {/* Share Media Dialog */}
      <ShareMediaDialog
        onAttach={(track) =>
          setAttachments((current) => [
            ...current,
            {
              displayName: track.title,
              sourceTrackId: track.id,
              url: track.streamUrl,
            },
          ])
        }
        onOpenChange={setIsShareMediaOpen}
        open={isShareMediaOpen}
      />

      {/* Help Guide Dialog */}
      <HelpCommandDialog onOpenChange={setIsHelpOpen} open={isHelpOpen} />

      {/* New Chat Dialog */}
      <NewChatDialog
        initialFriendId={targetFriendId}
        onConversationCreated={(id) => setSelectedId(id)}
        onOpenChange={setIsNewChatOpen}
        open={isNewChatOpen}
      />
    </div>
  );
}

function CollaborationDialog({
  conversationId,
  onOpenChange,
  onSuccess,
  open,
}: {
  conversationId: string;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  open: boolean;
}) {
  const [kind, setKind] = useState<"project" | "track">("project"),
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
        setTitle("");
        onOpenChange(false);
        toast({
          description: `Collaboration proposal for "${title}" sent! Collaborator has 24 hours to accept.`,
          title: "Proposal Sent",
        });
        if (onSuccess) {
          onSuccess();
        }
      } catch {
        toast({
          description: "Failed to send collaboration proposal.",
          title: "Error",
          variant: "destructive",
        });
      } finally {
        setIsCreating(false);
      }
    };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="size-5 text-primary" />
            Start Shared Collaboration Proposal
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={createCollaboration}>
          <div className="space-y-2">
            <Label className="text-xs">Collaboration Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={kind === "project" ? "default" : "outline"}
                onClick={() => setKind("project")}
                className="text-xs h-9"
              >
                Project (Album / EP)
              </Button>
              <Button
                type="button"
                variant={kind === "track" ? "default" : "outline"}
                onClick={() => setKind("track")}
                className="text-xs h-9"
              >
                Single Track
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="collaboration-title" className="text-xs">
              Project Title
            </Label>
            <Input
              id="collaboration-title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Summer Studio Session 2026"
              required
              value={title}
              className="text-xs"
            />
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary" />
              24-Hour Expiration Window
            </p>
            <p>
              A draft collaboration will be proposed in chat. Once accepted,
              both artists unlock full contribution access.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              className="text-xs gap-1.5"
              disabled={isCreating || !title.trim()}
              type="submit"
            >
              {isCreating ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Send Proposal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ShareMediaDialog({
  onAttach,
  onOpenChange,
  open,
}: {
  onAttach: (track: { id: string; streamUrl: string; title: string }) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const uploadedTracks = useTracksQuery(),
    savedTracks = useLibrarySavedQuery();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="size-5 text-primary" />
            Share Music From Library
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-80 overflow-y-auto">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Uploaded Tracks
            </p>
            {(uploadedTracks.data ?? []).length > 0 ? (
              <div className="space-y-1.5">
                {(uploadedTracks.data ?? []).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2 rounded-lg border bg-muted/30 hover:bg-muted transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs truncate">
                        {t.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {t.genre ?? "SoundKit Original"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        onAttach({
                          id: t.id,
                          streamUrl: `/tracks/${t.id}`,
                          title: t.title,
                        });
                        onOpenChange(false);
                        toast({
                          description: `Attached "${t.title}" to message.`,
                        });
                      }}
                    >
                      Attach
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No uploaded tracks found.
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Saved Tracks
            </p>
            {(savedTracks.data ?? []).length > 0 ? (
              <div className="space-y-1.5">
                {(savedTracks.data ?? []).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2 rounded-lg border bg-muted/30 hover:bg-muted transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs truncate">
                        {t.title}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        onAttach({
                          id: t.id,
                          streamUrl: `/tracks/${t.id}`,
                          title: t.title,
                        });
                        onOpenChange(false);
                        toast({
                          description: `Attached "${t.title}" to message.`,
                        });
                      }}
                    >
                      Attach
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No saved tracks in library.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HelpCommandDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="size-5 text-primary" />
            SoundKit Chat Commands Guide
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-xs">
          <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
            <div className="flex items-center justify-between font-mono font-bold text-primary">
              <span>/collab [title]</span>
              <Badge variant="secondary" className="text-[10px]">
                Collaborations
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Proposes a shared music project or track workspace with a 24-hour
              invitation window. The recipient can accept or decline directly in
              chat.
            </p>
          </div>

          <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
            <div className="flex items-center justify-between font-mono font-bold text-primary">
              <span>/share</span>
              <Badge variant="secondary" className="text-[10px]">
                Media Sharing
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Opens the media picker to attach playable audio previews, beat
              kits, and stems directly into the chat stream.
            </p>
          </div>
        </div>
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
  onConversationCreated?: (conversationId: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [selectedFriends, setSelectedFriends] = useState<FriendSummary[]>([]),
    [search, setSearch] = useState(""),
    [message, setMessage] = useState(""),
    friendsQuery = useFriendsQuery(),
    startConversation = useStartConversationMutation(),
    { isUserOnline } = usePresence(),
    friends = useMemo(
      () => (Array.isArray(friendsQuery.data) ? friendsQuery.data : []),
      [friendsQuery.data]
    ),
    peopleSearchQuery = usePeopleSearchQuery(search),
    normalizedSearch = search.trim().toLowerCase();

  useEffect(() => {
    if (initialFriendId && open) {
      const match = friends.find((f) => f.id === initialFriendId);
      if (match) {
        setSelectedFriends([match]);
      }
    }
  }, [friends, initialFriendId, open]);

  const allCandidates = useMemo(() => {
      const candidatesMap = new Map<string, FriendSummary>();
      for (const friend of friends) {
        candidatesMap.set(friend.id, friend);
      }
      if (Array.isArray(peopleSearchQuery.data)) {
        for (const person of peopleSearchQuery.data) {
          if (!candidatesMap.has(person.userId)) {
            candidatesMap.set(person.userId, {
              avatarUrl: person.avatarUrl,
              email: person.email,
              id: person.userId,
              lastInteractionAt: null,
              name: person.displayName,
              relationship: "friend" as const,
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
    filteredCandidates = useMemo(
      () =>
        allCandidates
          .filter((candidate) => !selectedIds.has(candidate.id))
          .filter((candidate) => {
            if (!normalizedSearch) {
              return true;
            }
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
          message: message.trim()
            ? { attachments: [], body: message.trim() }
            : undefined,
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
              {isGroupChat ? "New Group Conversation" : "New Message"}
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {friends.length} Connections
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={startChat}>
          <div className="space-y-2">
            <div className="relative">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
              <Input
                className="pl-9 text-xs"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search artists by name, @handle, or email..."
                value={search}
              />
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
                aria-label={`Select ${candidate.name}`}
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
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 size-2 rounded-full ring-1 ring-background transition-colors",
                      isUserOnline(candidate.id)
                        ? "bg-emerald-500 shadow-sm"
                        : "bg-muted-foreground/30"
                    )}
                  />
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
              </button>
            ))}
            {filteredCandidates.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">
                {search.trim().length > 0
                  ? `No users found matching "${search}".`
                  : selectedFriends.length > 0
                    ? "Type above to search and add more participants."
                    : "Search users by name, username, or email to start a conversation."}
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
              <Link search={{ tab: "friends" }} to="/dashboard/collaborators">
                Open Network
              </Link>
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
  const { isUserOnline } = usePresence(),
    online = conversation.participantId
      ? isUserOnline(conversation.participantId)
      : false;

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
          <AvatarImage src={conversation.participantAvatarUrl ?? undefined} />
          <AvatarFallback className="bg-muted text-xs">
            {initials(
              conversation.participantName || conversation.title || "Direct"
            )}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-background transition-colors",
            online
              ? "bg-emerald-500 shadow-sm animate-pulse"
              : "bg-muted-foreground/30"
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between">
          <p
            className={cn(
              "font-semibold text-xs transition-colors",
              isSelected ? "text-primary" : "text-foreground"
            )}
          >
            {conversation.participantName ||
              (conversation.title === "Untitled conversation"
                ? "Direct Message"
                : conversation.title)}
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
