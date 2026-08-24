import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@soundkit/ui/components/message-scroller";
/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp, prefer-named-capture-group, no-nested-ternary, unicorn/no-nested-ternary */
import {
  ChevronRight,
  Crown,
  MessageSquare,
  Music2,
  PanelRightClose,
  Send,
  Shield,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import type { LiveRoomState, LiveRoomTrack } from "@/lib/live-room";
import { useMeQuery } from "@/lib/soundkit-api-hooks";

import { AppImage } from "../ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { UserProfilePreviewModal } from "./user-profile-preview-modal";
import type { UserPreviewData } from "./user-profile-preview-modal";

interface LiveChatPanelProps {
  className?: string;
  disabled?: boolean;
  extraHeaderAction?: React.ReactNode;
  fillHeight?: boolean;
  messages: LiveRoomState["chat"];
  onCollapse?: () => void;
  onSend: (message: string) => void;
  title?: string;
}

export function LiveChatPanel({
  className = "",
  disabled,
  extraHeaderAction,
  fillHeight = false,
  messages,
  onCollapse,
  onSend,
  title = "Stream Chat",
}: LiveChatPanelProps) {
  const [message, setMessage] = useState(""),
    [previewUser, setPreviewUser] = useState<UserPreviewData | null>(null),
    meQuery = useMeQuery(),
    meUser = meQuery.data?.user,
    meProfile = meUser,
    send = () => {
      const trimmedMessage = message.trim();
      if (!trimmedMessage) {
        return;
      }

      onSend(trimmedMessage);
      setMessage("");
    };

  return (
    <>
      <Card
        className={`border-border/60 bg-card/95 backdrop-blur-md transition-all ${
          fillHeight
            ? "flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 shadow-none bg-transparent"
            : ""
        } ${className}`}
      >
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            {onCollapse && (
              <Button
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={onCollapse}
                size="icon"
                title="Collapse Chat"
                type="button"
                variant="ghost"
              >
                <PanelRightClose className="size-4" />
              </Button>
            )}
            <CardTitle className="font-semibold text-sm tracking-wide">
              {title}
            </CardTitle>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">
              {messages.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5">{extraHeaderAction}</div>
        </CardHeader>

        <CardContent
          className={`p-0 ${
            fillHeight
              ? "flex min-h-0 flex-1 flex-col justify-between"
              : "space-y-4 p-4"
          }`}
        >
          <div className={fillHeight ? "min-h-0 flex-1" : "h-80"}>
            <MessageScrollerProvider autoScroll defaultScrollPosition="end">
              <MessageScroller>
                <MessageScrollerViewport className="px-4 py-3">
                  <MessageScrollerContent className="gap-2.5">
                    {messages.length === 0 && (
                      <MessageScrollerItem messageId="empty-live-room-chat">
                        <div className="py-12 text-center text-xs text-muted-foreground">
                          <MessageSquare className="mx-auto mb-2 size-6 text-muted-foreground/50" />
                          Welcome to the stream chat! Say hello to the room.
                        </div>
                      </MessageScrollerItem>
                    )}
                    {messages.map((chatMessage) => {
                      const isMe =
                          chatMessage.userName.toLowerCase() === "you" ||
                          chatMessage.userName === meUser?.displayName ||
                          chatMessage.userName === meProfile?.displayName,
                        isBot =
                          chatMessage.userName.toLowerCase().includes("bot") ||
                          chatMessage.userName.toLowerCase().includes("system"),
                        isHost =
                          chatMessage.userName.toLowerCase().includes("host") ||
                          chatMessage.userName.toLowerCase().includes("artist"),
                        userAvatar = isMe
                          ? (meProfile?.avatarUrl ??
                            meUser?.avatarUrl ??
                            "/placeholder-user.jpg")
                          : "/placeholder-user.jpg",
                        handleOpenProfile = () => {
                          if (isMe && meUser) {
                            setPreviewUser({
                              avatarUrl:
                                meProfile?.avatarUrl ??
                                meUser.avatarUrl ??
                                "/placeholder-user.jpg",
                              bio:
                                meProfile?.bio ?? "SoundKit artist & creator.",
                              displayName:
                                meProfile?.displayName ??
                                meUser.displayName ??
                                "You",
                              followersCount: 1450,
                              genre: "SoundKit Artist",
                              id: meUser.id,
                              role:
                                meUser.role === "admin"
                                  ? "Platform Admin"
                                  : "SoundKit Artist",
                              username:
                                meProfile?.username ?? meUser.username ?? "you",
                              verified: true,
                            });
                          } else {
                            setPreviewUser({
                              avatarUrl: "/placeholder-user.jpg",
                              displayName: chatMessage.userName,
                              role: isHost
                                ? "Host & Creator"
                                : isBot
                                  ? "Chat Bot"
                                  : "Community Member",
                              username: chatMessage.userName
                                .toLowerCase()
                                .replaceAll(/\s+/g, ""),
                            });
                          }
                        };

                      return (
                        <MessageScrollerItem
                          key={chatMessage.id}
                          messageId={chatMessage.id}
                          scrollAnchor={isMe}
                        >
                          <div
                            className={`group flex items-start gap-2.5 rounded-md p-1.5 transition-colors hover:bg-muted/40 ${
                              isBot
                                ? "border-l-2 border-primary/60 bg-primary/5"
                                : ""
                            }`}
                          >
                            <button
                              className="shrink-0 cursor-pointer transition-transform hover:scale-105"
                              onClick={handleOpenProfile}
                              type="button"
                            >
                              <Avatar className="size-6 border border-border/30">
                                <AvatarImage src={userAvatar} />
                                <AvatarFallback className="text-[10px]">
                                  {chatMessage.userName
                                    .slice(0, 1)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </button>
                            <div className="min-w-0 flex-1 text-xs">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {isHost && (
                                  <span className="flex items-center gap-0.5 rounded bg-primary/20 px-1 py-0.2 font-bold text-[9px] text-primary">
                                    <Crown className="size-2.5" />
                                    HOST
                                  </span>
                                )}
                                {isBot && (
                                  <span className="flex items-center gap-0.5 rounded bg-secondary px-1 py-0.2 font-bold text-[9px]">
                                    <Sparkles className="size-2.5 text-primary" />
                                    BOT
                                  </span>
                                )}
                                <button
                                  className="font-semibold text-foreground hover:text-primary transition-colors text-left truncate cursor-pointer"
                                  onClick={handleOpenProfile}
                                  type="button"
                                >
                                  {chatMessage.userName}
                                </button>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(
                                    chatMessage.sentAt
                                  ).toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p className="mt-0.5 break-words text-muted-foreground/90 leading-relaxed">
                                {chatMessage.message}
                              </p>
                            </div>
                          </div>
                        </MessageScrollerItem>
                      );
                    })}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>
          </div>

          {/* Bottom input bar with safe mobile padding above ExploreMobileNav */}
          <div className="border-t border-border/40 p-3 bg-background/50 max-lg:pb-24">
            <div className="flex items-center gap-2">
              <Input
                className="h-9 text-xs"
                disabled={disabled}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder="Send a message..."
                value={message}
              />
              <Button
                className="h-9 px-3 shrink-0"
                disabled={disabled || !message.trim()}
                onClick={send}
                size="sm"
              >
                <Send className="size-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <UserProfilePreviewModal
        onClose={() => setPreviewUser(null)}
        open={Boolean(previewUser)}
        user={previewUser}
      />
    </>
  );
}

export function LiveTrackQueue({ tracks }: { tracks: LiveRoomTrack[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Music2 className="size-4" />
          Tracklist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tracks.map((track) => (
          <div
            className="flex items-center gap-3 rounded-lg border p-3"
            key={track.id}
          >
            <AppImage
              alt={track.title}
              className="size-12 rounded-md object-cover"
              height={48}
              src={track.coverArtUrl}
              width={48}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{track.title}</p>
              <p className="truncate text-sm text-muted-foreground">
                {track.artistName}
              </p>
            </div>
            <Badge variant={track.status === "playing" ? "default" : "outline"}>
              {track.status === "playing" ? "Now" : track.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function LiveLyricsPanel({ track }: { track?: LiveRoomTrack }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lyrics</CardTitle>
      </CardHeader>
      <CardContent>
        {track ? (
          <div className="space-y-4">
            <div>
              <p className="font-medium">{track.title}</p>
              <p className="text-sm text-muted-foreground">
                {track.artistName}
              </p>
            </div>
            <div className="space-y-3 text-lg leading-8">
              {track.lyrics.map((line) => (
                <p
                  className="rounded-md border-l-2 border-primary/60 bg-muted/40 px-3 py-2"
                  key={`${track.id}-${line.startMs}`}
                >
                  {line.text}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Lyrics will appear when the next track starts.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
