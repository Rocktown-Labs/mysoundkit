"use client";

/* eslint-disable no-unused-vars, sort-vars, one-var, complexity, no-nested-ternary, unicorn/no-nested-ternary */
import { useUploadFiles } from "@better-upload/client";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Clock,
  Download,
  ExternalLink,
  FileText,
  FolderKanban,
  Headphones,
  Heart,
  LoaderCircle,
  Maximize2,
  MessageCircle,
  MessageSquare,
  Music,
  Paperclip,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  SquarePen,
  Terminal,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { PlayerTrack } from "@/components/audio-player-provider";
import { useAudioPlayer } from "@/components/audio-player-provider";
import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { API_V1_URL, MEDIA_BASE_URL, MEDIA_UPLOAD_URL } from "@/lib/api";
import { isImmersiveExploreRoute } from "@/lib/immersive-route";
import {
  useCreateMessageCollectionMutation,
  useMessagingMessages,
} from "@/lib/message-db";
import { usePresence } from "@/lib/presence-context";
import {
  useConversationsQuery,
  useFriendsQuery,
  useLibrarySavedQuery,
  useMeQuery,
  useStartConversationMutation,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";
import type { FriendSummary } from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

const FALLBACK_AVATAR = "/diverse-user-avatars.png",
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
  ],
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

interface ChatAttachment {
  displayName: string;
  mimeType?: string;
  objectKey?: string;
  sizeBytes?: number;
  sourceProjectId?: string;
  sourceTrackId?: string;
  url: string;
}

export function FloatingChatBar() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated ? <FloatingChatBarClient /> : null;
}

function FloatingChatBarClient() {
  const [view, setView] = useState<"list" | "chat">("list"),
    [isNewChatOpen, setIsNewChatOpen] = useState(false),
    [searchQuery, setSearchQuery] = useState(""),
    [activeConversationId, setActiveConversationId] = useState(""),
    [isOpen, setIsOpen] = useState(false),
    [messageInput, setMessageInput] = useState(""),
    [attachments, setAttachments] = useState<ChatAttachment[]>([]),
    [showMusicPicker, setShowMusicPicker] = useState(false),
    [musicPickerTab, setMusicPickerTab] = useState<
      "uploads" | "saved" | "search"
    >("uploads"),
    [musicSearchQuery, setMusicSearchQuery] = useState(""),
    [showHelpGuide, setShowHelpGuide] = useState(false),
    [showInlineCollab, setShowInlineCollab] = useState(false),
    [isCollabDialogOpen, setIsCollabDialogOpen] = useState(false),
    [collabTitle, setCollabTitle] = useState(""),
    [collabProjectType, setCollabProjectType] = useState<
      "album" | "ep" | "single"
    >("single"),
    [collabKind, setCollabKind] = useState<"project" | "track">("project"),
    [isSubmittingCollab, setIsSubmittingCollab] = useState(false),
    fileInputRef = useRef<HTMLInputElement | null>(null),
    {
      currentTrack,
      isPlaying,
      setCurrentTrack,
      setIsPlaying,
      setQueue,
      setVisible,
    } = useAudioPlayer(),
    pathname = useRouterState({
      select: (state) => state.location.pathname,
    }),
    meQuery = useMeQuery(),
    isArtist =
      meQuery.data?.user.accountType === "artist" ||
      meQuery.data?.user.role === "admin",
    conversationsQuery = useConversationsQuery(isArtist),
    friendsQuery = useFriendsQuery(),
    uploadedTracksQuery = useTracksQuery(),
    savedTracksQuery = useLibrarySavedQuery(),
    startConversation = useStartConversationMutation(),
    { isUserOnline, registerPresenceUsers } = usePresence(),
    conversations = useMemo(
      () =>
        Array.isArray(conversationsQuery.data) ? conversationsQuery.data : [],
      [conversationsQuery.data]
    ),
    friends = useMemo(
      () => (Array.isArray(friendsQuery.data) ? friendsQuery.data : []),
      [friendsQuery.data]
    ),
    activeConversation =
      conversations.find(({ id }) => id === activeConversationId) ??
      conversations[0] ??
      null,
    conversationId = activeConversation?.id ?? "",
    messagesQuery = useMessagingMessages(conversationId),
    createMessage = useCreateMessageCollectionMutation(
      conversationId,
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
    messages = messagesQuery.data ?? [],
    totalUnread = conversations.reduce(
      (total, conversation) => total + conversation.unreadCount,
      0
    ),
    filteredConversations = useMemo(() => {
      if (!searchQuery.trim()) {
        return conversations;
      }
      const q = searchQuery.toLowerCase();
      return conversations.filter(
        (c) =>
          c.participantName?.toLowerCase().includes(q) ||
          c.participantUsername?.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q)
      );
    }, [conversations, searchQuery]),
    filteredFriends = useMemo(() => {
      if (!searchQuery.trim()) {
        return friends;
      }
      const q = searchQuery.toLowerCase();
      return friends.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.username?.toLowerCase().includes(q) ||
          f.role?.toLowerCase().includes(q)
      );
    }, [friends, searchQuery]),
    isSlashActive = messageInput.startsWith("/"),
    matchingCommands = isSlashActive
      ? SLASH_COMMANDS.filter((cmd) =>
          cmd.command
            .toLowerCase()
            .startsWith(messageInput.split(" ")[0].toLowerCase())
        )
      : [],
    handleOpenConversation = (convoId: string) => {
      setActiveConversationId(convoId);
      setView("chat");
      setIsNewChatOpen(false);
      setSearchQuery("");
    },
    handleStartFriendChat = (friend: FriendSummary) => {
      const existing = conversations.find(
        (c) =>
          (c.participantId && c.participantId === friend.id) ||
          c.title.toLowerCase().includes(friend.name.toLowerCase()) ||
          (friend.username &&
            c.title.toLowerCase().includes(friend.username.toLowerCase()))
      );

      if (existing) {
        setActiveConversationId(existing.id);
        setView("chat");
        setIsNewChatOpen(false);
        setSearchQuery("");
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
          onSuccess: (newConvo) => {
            if (newConvo?.id) {
              setActiveConversationId(newConvo.id);
              setView("chat");
              setIsNewChatOpen(false);
              setSearchQuery("");
            }
          },
        }
      );
    };

  useEffect(
    () =>
      registerPresenceUsers([
        ...friends.map((friend) => friend.id),
        ...conversations.flatMap((conversation) =>
          conversation.participantId ? [conversation.participantId] : []
        ),
      ]),
    [conversations, friends, registerPresenceUsers]
  );

  if (
    !isArtist ||
    pathname.startsWith("/dashboard/messages") ||
    isImmersiveExploreRoute(pathname) ||
    pathname.startsWith("/live/")
  ) {
    return null;
  }

  const handleSendProposal = async () => {
      const projectTitle = collabTitle.trim() || "Untitled Collaboration";
      setIsSubmittingCollab(true);
      try {
        const response = await fetch(
          `${API_V1_URL}/messages/conversations/${encodeURIComponent(conversationId)}/collaborations`,
          {
            body: JSON.stringify({ kind: collabKind, title: projectTitle }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }
        );
        if (!response.ok) {
          throw new Error("Could not start collaboration.");
        }
        setIsCollabDialogOpen(false);
        setCollabTitle("");
        setMessageInput("");
        toast({
          description: `Proposal for "${projectTitle}" sent! Collaborator has 24h to accept.`,
          title: "Collaboration Proposal Sent",
        });
        messagesQuery.refetch();
      } catch {
        toast({
          description: "Failed to send collaboration proposal.",
          title: "Error",
          variant: "destructive",
        });
      } finally {
        setIsSubmittingCollab(false);
      }
    },
    handleRespondCollaboration = async (
      projectId: string,
      action: "accept" | "decline" | "cancel"
    ) => {
      try {
        const response = await fetch(
          `${API_V1_URL}/messages/conversations/${encodeURIComponent(conversationId)}/collaborations/${encodeURIComponent(projectId)}/respond`,
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
    handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const rawText = messageInput.trim();

      if (rawText === "/collab" || rawText.startsWith("/collab ")) {
        const customTitle = rawText.replace(/^\/collab\s*/iu, "").trim();
        setCollabTitle(customTitle || "Collaboration Project");
        setShowInlineCollab(true);
        setShowMusicPicker(false);
        setMessageInput("");
        return;
      }
      if (rawText === "/share") {
        setShowMusicPicker(true);
        setMessageInput("");
        return;
      }
      if (rawText.startsWith("/share ") && attachments.length === 0) {
        const remaining = rawText.replace(/^\/share\s*/iu, "").trim();
        setMessageInput(remaining);
        setShowMusicPicker(true);
        return;
      }
      if (rawText === "/help") {
        setShowHelpGuide(true);
        setMessageInput("");
        return;
      }

      const text = rawText.replace(/^\/share\s*/iu, "").trim();

      if (!text && attachments.length === 0) {
        return;
      }

      createMessage.mutate(
        {
          attachments,
          body: text,
        },
        {
          onSuccess: () => {
            setMessageInput("");
            setAttachments([]);
          },
        }
      );
    },
    bottomPositionClass = currentTrack
      ? "bottom-36 sm:bottom-28 right-4 sm:right-6"
      : "bottom-20 sm:bottom-6 right-4 sm:right-6";

  const isOtherUserOnline = activeConversation?.participantId
    ? isUserOnline(activeConversation.participantId)
    : false;

  return (
    <div
      className={cn(
        "fixed z-40 transition-all duration-300",
        bottomPositionClass
      )}
    >
      {isOpen ? (
        <Card className="w-[340px] sm:w-[420px] shadow-2xl border-primary/30 bg-card/95 backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200 overflow-hidden flex flex-col h-[520px]">
          {/* Instagram-Style View Switcher: LIST VIEW */}
          {view === "list" ? (
            <>
              {/* Inbox Header */}
              <CardHeader className="p-3 border-b flex flex-row items-center justify-between space-y-0 bg-background/50">
                <div className="flex items-center gap-2">
                  <MessageCircle className="size-5 text-primary" />
                  <CardTitle className="text-sm sm:text-base font-bold">
                    Messages
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {conversations.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full"
                    onClick={() => setIsNewChatOpen((prev) => !prev)}
                    title={isNewChatOpen ? "Back to Inbox" : "New Message"}
                  >
                    <SquarePen className="size-4 text-foreground" />
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full"
                    title="Enlarge to full messages page"
                  >
                    <Link to="/dashboard/messages">
                      <Maximize2 className="size-4 text-foreground" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close Chat"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </CardHeader>

              {/* Search Bar */}
              <div className="p-2 border-b bg-muted/20">
                <div className="relative flex items-center">
                  <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      isNewChatOpen
                        ? "Search friends & collaborators..."
                        : "Search messages or artists..."
                    }
                    className="h-8 pl-8 text-xs bg-background/60"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Single Scrollable Inbox Feed */}
              <ScrollArea className="flex-1 p-2">
                {isNewChatOpen ? (
                  <div className="space-y-1">
                    <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      New Conversation
                    </div>
                    {filteredFriends.length > 0 ? (
                      filteredFriends.map((friend) => {
                        const online = isUserOnline(friend.id);
                        return (
                          <button
                            type="button"
                            key={friend.id}
                            className="w-full text-left flex items-center justify-between p-2 rounded-lg hover:bg-muted/60 transition group cursor-pointer"
                            onClick={() => handleStartFriendChat(friend)}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="relative">
                                <Avatar className="size-9 border border-border/50">
                                  <AvatarImage
                                    src={friend.avatarUrl ?? FALLBACK_AVATAR}
                                  />
                                  <AvatarFallback>
                                    {friend.name.charAt(0)}
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
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate">
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
                              className="text-xs h-7 px-2.5 gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartFriendChat(friend);
                              }}
                            >
                              <MessageCircle className="size-3" />
                              Chat
                            </Button>
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center text-xs text-muted-foreground">
                        No collaborators found matching search.
                      </div>
                    )}
                  </div>
                ) : filteredConversations.length > 0 ? (
                  <div className="space-y-1">
                    {filteredConversations.map((convo) => {
                      const online = convo.participantId
                        ? isUserOnline(convo.participantId)
                        : false;
                      return (
                        <button
                          type="button"
                          key={convo.id}
                          onClick={() => handleOpenConversation(convo.id)}
                          className={cn(
                            "w-full text-left flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/60 transition cursor-pointer border border-transparent hover:border-border/40",
                            convo.unreadCount > 0 && "bg-primary/5"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <Avatar className="size-10 border border-border/50">
                                <AvatarImage
                                  src={
                                    convo.participantAvatarUrl ??
                                    FALLBACK_AVATAR
                                  }
                                />
                                <AvatarFallback>
                                  {(convo.participantName ?? convo.title)
                                    .slice(0, 2)
                                    .toUpperCase()}
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
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold truncate">
                                  {convo.participantName ?? convo.title}
                                </p>
                                {convo.participantUsername && (
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    @{convo.participantUsername}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {convo.title === convo.participantName
                                  ? "Click to open conversation"
                                  : convo.title}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {formatMessageTime(convo.updatedAt)}
                            </span>
                            {convo.unreadCount > 0 && (
                              <Badge className="size-4 p-0 text-[9px] flex items-center justify-center rounded-full bg-primary text-primary-foreground">
                                {convo.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center space-y-3">
                    <MessageSquare className="mx-auto size-8 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">
                      No active conversations found.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsNewChatOpen(true)}
                      className="gap-1.5 text-xs"
                    >
                      <Plus className="size-3.5" />
                      Start a Conversation
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            /* Instagram-Style View Switcher: CONVERSATION VIEW */
            <>
              {/* Conversation Detail Header */}
              <CardHeader className="p-2.5 sm:p-3 border-b flex flex-row items-center justify-between space-y-0 bg-background/60">
                <div className="flex items-center gap-2 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full shrink-0"
                    onClick={() => setView("list")}
                    title="Back to inbox"
                  >
                    <ArrowLeft className="size-4 text-foreground" />
                  </Button>

                  <div className="relative shrink-0">
                    <Avatar className="size-8 border border-border/50">
                      <AvatarImage
                        src={
                          activeConversation?.participantAvatarUrl ??
                          FALLBACK_AVATAR
                        }
                      />
                      <AvatarFallback>
                        {(activeConversation?.participantName ?? "SK")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 size-2 rounded-full ring-1 ring-background",
                        isOtherUserOnline
                          ? "bg-emerald-500 animate-pulse"
                          : "bg-muted-foreground/30"
                      )}
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate leading-none">
                      {activeConversation?.participantName ??
                        activeConversation?.title ??
                        "Chat"}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className={cn(
                          "text-[10px] font-medium leading-none",
                          isOtherUserOnline
                            ? "text-emerald-500 font-semibold"
                            : "text-muted-foreground"
                        )}
                      >
                        {isOtherUserOnline ? "Active now" : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full"
                    title="Enlarge to full messages page"
                  >
                    <Link to="/dashboard/messages" search={{ conversationId }}>
                      <Maximize2 className="size-3.5 text-foreground" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close Chat"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </CardHeader>

              {/* Messages Feed */}
              <MessageScrollerProvider autoScroll defaultScrollPosition="end">
                <MessageScroller>
                  <MessageScrollerViewport>
                    <MessageScrollerContent className="gap-3 p-3">
                      {messages.length > 0 ? (
                  messages.map((message) => {
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
                          "flex flex-col max-w-[88%]",
                          isMine ? "ml-auto items-end" : "mr-auto items-start"
                        )}
                      >
                        {/* Collaboration Proposal Rich Card */}
                        {hasCollabProposal && collabAtt ? (
                          <div className="rounded-2xl border-2 border-primary/40 bg-card/95 p-3 shadow-md space-y-2.5 text-xs w-full max-w-[280px]">
                            <div className="flex items-center justify-between border-b pb-1.5">
                              <div className="flex items-center gap-1.5 font-bold text-primary">
                                <FolderKanban className="size-4" />
                                <span>Shared Collaboration</span>
                              </div>
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0"
                              >
                                Draft
                              </Badge>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-foreground">
                                {collabAtt.displayName}
                              </p>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="size-3 text-amber-400" />
                                24h Acceptance Window
                              </p>
                            </div>
                            <div className="flex flex-col gap-1.5 pt-1">
                              {isMine ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px] text-muted-foreground hover:text-destructive w-full"
                                  onClick={() =>
                                    handleRespondCollaboration(
                                      collabAtt.sourceProjectId ?? "",
                                      "cancel"
                                    )
                                  }
                                >
                                  Cancel Invite
                                </Button>
                              ) : (
                                <div className="grid grid-cols-2 gap-1.5">
                                  <Button
                                    size="sm"
                                    className="h-7 text-[11px] gap-1 bg-primary"
                                    onClick={() =>
                                      handleRespondCollaboration(
                                        collabAtt.sourceProjectId ?? "",
                                        "accept"
                                      )
                                    }
                                  >
                                    <Check className="size-3" />
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px]"
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
                                  className="h-7 text-[11px] w-full gap-1"
                                >
                                  <a
                                    href={collabAtt.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="size-3" />
                                    Open Project Workspace
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "rounded-2xl px-3 py-2 text-xs shadow-sm space-y-1.5",
                              isMine
                                ? "bg-primary text-primary-foreground rounded-br-none"
                                : "bg-muted text-foreground rounded-bl-none"
                            )}
                          >
                            <p className="leading-relaxed whitespace-pre-wrap break-words">
                              {message.body}
                            </p>

                            {/* Audio & File Attachments */}
                            {Array.isArray(message.attachments) &&
                              message.attachments.length > 0 && (
                                <div className="space-y-1 pt-1 border-t border-border/20">
                                  {message.attachments.map((att, idx) => {
                                    const isAudio =
                                      att.mimeType?.startsWith("audio/") ||
                                      Boolean(att.sourceTrackId);
                                    const trackId =
                                      att.sourceTrackId ??
                                      att.id ??
                                      `shared_${idx}`;

                                    return (
                                      <div
                                        key={att.id ?? idx}
                                        className="flex items-center justify-between gap-2 rounded-lg bg-background/20 p-2 text-[11px]"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          {isAudio ? (
                                            <Button
                                              size="icon"
                                              variant="secondary"
                                              className="size-6 rounded-full shrink-0"
                                              onClick={() => {
                                                if (
                                                  isPlaying &&
                                                  currentTrack?.id === trackId
                                                ) {
                                                  setIsPlaying(false);
                                                } else if (
                                                  currentTrack?.id === trackId
                                                ) {
                                                  setIsPlaying(true);
                                                } else {
                                                  const playerTrack: PlayerTrack =
                                                    {
                                                      artist: "Shared Track",
                                                      cover:
                                                        "/night-music-album-cover.png",
                                                      id: trackId,
                                                      src: att.url,
                                                      title: att.displayName,
                                                      trackHref:
                                                        att.sourceTrackId
                                                          ? `/tracks/${att.sourceTrackId}`
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
                                              currentTrack?.id === trackId ? (
                                                <Pause className="size-3 fill-current" />
                                              ) : (
                                                <Play className="size-3 fill-current ml-0.5" />
                                              )}
                                            </Button>
                                          ) : (
                                            <Paperclip className="size-3.5 shrink-0 text-primary" />
                                          )}
                                          <span className="font-medium truncate max-w-[140px]">
                                            {att.displayName}
                                          </span>
                                        </div>
                                        <Button
                                          asChild
                                          size="icon"
                                          variant="ghost"
                                          className="size-5 rounded-full shrink-0 opacity-75 hover:opacity-100"
                                        >
                                          <a
                                            href={att.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download
                                          >
                                            <Download className="size-3" />
                                          </a>
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                          </div>
                        )}
                        <span
                          className={cn(
                            "mt-0.5 px-1 text-[9px]",
                            isMine
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        </div>
                      </MessageScrollerItem>
                    );
                  })
                ) : (
                  <MessageScrollerItem messageId="empty-floating-messages">
                    <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground space-y-1.5 py-12">
                    <MessageCircle className="size-7 text-muted-foreground/40" />
                    <p className="font-medium">No messages yet</p>
                    <p className="text-[11px]">
                      Send a message or type{" "}
                      <code className="bg-muted px-1 py-0.5 rounded font-mono text-primary">
                        /collab
                      </code>
                    </p>
                    </div>
                  </MessageScrollerItem>
                )}
                    </MessageScrollerContent>
                  </MessageScrollerViewport>
                  <MessageScrollerButton />
                </MessageScroller>
              </MessageScrollerProvider>

              {/* Slash Command Helper Popup */}
              {isSlashActive && matchingCommands.length > 0 && (
                <div className="p-2 bg-popover border-t shadow-2xl z-50 text-xs space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
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
                          setShowHelpGuide(false);
                          setMessageInput("");
                        } else if (cmd.command === "/share") {
                          setShowMusicPicker(true);
                          setShowInlineCollab(false);
                          setShowHelpGuide(false);
                          setMessageInput((curr) =>
                            curr.replace(/^\/share\s*/iu, "").trim()
                          );
                        } else if (cmd.command === "/help") {
                          setShowHelpGuide(true);
                          setShowMusicPicker(false);
                          setShowInlineCollab(false);
                          setMessageInput("");
                        }
                      }}
                      className="w-full text-left p-1.5 rounded-lg hover:bg-muted transition flex flex-col gap-0.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-primary">
                          {cmd.command}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {cmd.label}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {cmd.description}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Inline Collab Popover */}
              {showInlineCollab && (
                <div className="p-3 bg-card border-t shadow-2xl z-50 text-xs space-y-2.5 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <span className="font-bold flex items-center gap-1.5 text-primary">
                      <FolderKanban className="size-3.5" />
                      Send Collaboration Invite
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
                        placeholder="e.g. Summer Beat Tape"
                        className="h-7 text-xs mt-0.5"
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
                      disabled={isSubmittingCollab || !collabTitle.trim()}
                      onClick={async () => {
                        await handleSendProposal();
                        setShowInlineCollab(false);
                      }}
                      className="w-full h-7 text-xs bg-primary gap-1"
                    >
                      <Check className="size-3" />
                      Send Collab Proposal
                    </Button>
                  </div>
                </div>
              )}

              {/* In-Chat Help Guide Panel */}
              {showHelpGuide && (
                <div className="p-3 bg-muted/60 border-t text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between font-bold border-b pb-1">
                    <span className="flex items-center gap-1.5 text-primary">
                      <Terminal className="size-3.5" />
                      SoundKit Chat Command Guide
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-5 rounded-full"
                      onClick={() => setShowHelpGuide(false)}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-muted-foreground">
                    <p>
                      <strong className="text-foreground font-mono">
                        /collab
                      </strong>
                      : Send a shared workspace proposal with 24h expiry.
                    </p>
                    <p>
                      <strong className="text-foreground font-mono">
                        /share
                      </strong>
                      : Attach and share audio & beat kits directly from your
                      library.
                    </p>
                  </div>
                </div>
              )}

              {/* Tabbed Music Library & Platform Search Attachment Selector Popup */}
              {showMusicPicker && (
                <div className="p-3 bg-card border-t shadow-2xl z-50 text-xs space-y-2 max-h-64 overflow-y-auto">
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
                      className="h-7 text-xs pl-7"
                    />
                    <Search className="size-3 text-muted-foreground absolute left-2 top-2" />
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
                            <span className="font-medium truncate max-w-[170px]">
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

              {/* Pending Attachments Strip */}
              {attachments.length > 0 && (
                <div className="px-2 py-1.5 bg-muted/40 border-t flex flex-wrap gap-1.5 items-center">
                  {attachments.map((att, index) => (
                    <div
                      key={att.url || att.displayName}
                      className="flex items-center gap-1 rounded-md bg-background border px-2 py-0.5 text-[10px]"
                    >
                      <Paperclip className="size-2.5 text-primary" />
                      <span className="max-w-[120px] truncate">
                        {att.displayName}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((curr) =>
                            curr.filter((_, i) => i !== index)
                          )
                        }
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Message Composer Form */}
              <form
                onSubmit={handleSendMessage}
                className="p-2.5 border-t bg-background/80 flex items-center gap-1.5"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      void upload([...e.target.files]);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  title="Attach file"
                >
                  {isUploading ? (
                    <LoaderCircle className="size-3.5 animate-spin text-primary" />
                  ) : (
                    <Paperclip className="size-3.5" />
                  )}
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowMusicPicker((prev) => !prev)}
                  title="Share music from library"
                >
                  <Music className="size-3.5" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0 text-muted-foreground hover:text-primary"
                  onClick={() => setIsCollabDialogOpen(true)}
                  title="Start collaboration proposal (/collab)"
                >
                  <FolderKanban className="size-3.5" />
                </Button>

                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Message or /collab..."
                  className="h-8 text-xs flex-1"
                />

                <Button
                  type="submit"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={
                    createMessage.isPending ||
                    (!messageInput.trim() && attachments.length === 0)
                  }
                >
                  {createMessage.isPending ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                </Button>
              </form>
            </>
          )}
        </Card>
      ) : (
        <Button
          onClick={() => {
            setIsOpen(true);
            setView("list");
          }}
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

      {/* Collaboration Dialog */}
      <Dialog open={isCollabDialogOpen} onOpenChange={setIsCollabDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="size-5 text-primary" />
              Start Collaboration Proposal
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">Collaboration Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={collabKind === "project" ? "default" : "outline"}
                  onClick={() => setCollabKind("project")}
                  className="text-xs h-9"
                >
                  Project (Album / EP)
                </Button>
                <Button
                  type="button"
                  variant={collabKind === "track" ? "default" : "outline"}
                  onClick={() => setCollabKind("track")}
                  className="text-xs h-9"
                >
                  Single Track
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs" htmlFor="floating-collab-title">
                Title
              </Label>
              <Input
                id="floating-collab-title"
                placeholder="e.g. Summer Studio Session 2026"
                value={collabTitle}
                onChange={(e) => setCollabTitle(e.target.value)}
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
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCollabDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendProposal}
              disabled={isSubmittingCollab || !collabTitle.trim()}
              className="text-xs gap-1.5"
            >
              {isSubmittingCollab ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Send Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
