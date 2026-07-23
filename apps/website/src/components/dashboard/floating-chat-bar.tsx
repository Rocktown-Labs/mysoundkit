"use client";

import {
  Check,
  ChevronDown,
  MessageCircle,
  Music2,
  Paperclip,
  Play,
  Radio,
  Send,
  Swords,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import React, { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";

export type UserPresence = "online" | "offline" | "in_battle" | "live_stream";

interface AttachmentItem {
  id: string;
  subtitle?: string;
  title: string;
  type: "track" | "open_verse" | "profile";
}

interface ChatMessage {
  attachment?: AttachmentItem;
  id: string;
  isSelf: boolean;
  sender: string;
  text: string;
  timestamp: string;
}

interface Conversation {
  avatar: string;
  id: string;
  messages: ChatMessage[];
  name: string;
  pendingRequest?: {
    id: string;
    title: string;
    type: "friend" | "message" | "challenge";
  };
  presence: UserPresence;
  unreadCount: number;
  username: string;
}

const initialConversations: Conversation[] = [
  {
    avatar: "/diverse-user-avatars.png",
    id: "conv-1",
    messages: [
      {
        attachment: {
          id: "tr-1",
          subtitle: "Beat Draft #3 (140 BPM)",
          title: "Summer Nights Collab Demo.mp3",
          type: "track",
        },
        id: "m-1",
        isSelf: false,
        sender: "Metro Flow",
        text: "Yo! Check out this new beat draft for our collab.",
        timestamp: "10:14 AM",
      },
    ],
    name: "Metro Flow",
    pendingRequest: {
      id: "req-1",
      title: "Battle Challenge: Best of 5 (Hip-Hop)",
      type: "challenge",
    },
    presence: "online",
    unreadCount: 1,
    username: "metro_flow",
  },
  {
    avatar: "/diverse-user-avatars.png",
    id: "conv-2",
    messages: [
      {
        id: "m-2",
        isSelf: false,
        sender: "Neon Pulse",
        text: "Sent you the synth stem files!",
        timestamp: "Yesterday",
      },
    ],
    name: "Neon Pulse",
    pendingRequest: {
      id: "req-2",
      title: "Friend Request",
      type: "friend",
    },
    presence: "in_battle",
    unreadCount: 1,
    username: "neon_pulse",
  },
  {
    avatar: "/diverse-user-avatars.png",
    id: "conv-3",
    messages: [
      {
        id: "m-3",
        isSelf: false,
        sender: "Luna Eclipse",
        text: "Im live streaming right now!",
        timestamp: "5m ago",
      },
    ],
    name: "Luna Eclipse",
    presence: "live_stream",
    unreadCount: 0,
    username: "luna_eclipse",
  },
];

function PresenceBadge({ presence }: { presence: UserPresence }) {
  if (presence === "online") {
    return (
      <span className="relative flex size-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
      </span>
    );
  }

  if (presence === "in_battle") {
    return (
      <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 text-[9px] px-1 py-0 h-4 font-mono">
        <Swords className="size-2.5 mr-1" /> Battle
      </Badge>
    );
  }

  if (presence === "live_stream") {
    return (
      <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[9px] px-1 py-0 h-4 font-mono animate-pulse">
        <Radio className="size-2.5 mr-1" /> Live
      </Badge>
    );
  }

  return <span className="size-2 rounded-full bg-muted-foreground/40" />;
}

export function FloatingChatBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations);
  const [activeConvId, setActiveConvId] = useState<string>("conv-1");
  const [messageInput, setMessageInput] = useState("");
  const [selectedAttachment, setSelectedAttachment] =
    useState<AttachmentItem | null>(null);

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() && !selectedAttachment) {return;}

    const newMessage: ChatMessage = {
      attachment: selectedAttachment ?? undefined,
      id: `msg-${Date.now()}`,
      isSelf: true,
      sender: "You",
      text: messageInput.trim(),
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === activeConvId) {
          return {
            ...conv,
            messages: [...conv.messages, newMessage],
            unreadCount: 0,
          };
        }
        return conv;
      })
    );

    setMessageInput("");
    setSelectedAttachment(null);
    toast({
      description: "Message sent successfully.",
      title: "Sent",
    });
  };

  const handleActionRequest = (
    convId: string,
    action: "accept" | "decline"
  ) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === convId) {
          const reqType = c.pendingRequest?.type;
          toast({
            description: `${action === "accept" ? "Accepted" : "Declined"} ${
              reqType ?? "request"
            } from @${c.username}.`,
            title:
              action === "accept" ? "Request Accepted" : "Request Declined",
          });
          return { ...c, pendingRequest: undefined };
        }
        return c;
      })
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
            {/* Conversation Tabs Bar with Presence */}
            <div className="flex items-center gap-1.5 p-2 border-b bg-muted/30 overflow-x-auto">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => {
                    setActiveConvId(conv.id);
                    setConversations((prev) =>
                      prev.map((c) =>
                        c.id === conv.id ? { ...c, unreadCount: 0 } : c
                      )
                    );
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeConvId === conv.id
                      ? "bg-primary text-primary-foreground shadow"
                      : "hover:bg-muted/60 text-muted-foreground"
                  }`}
                >
                  <div className="relative">
                    <Avatar className="size-4">
                      <AvatarImage src={conv.avatar} />
                      <AvatarFallback>{conv.name[0]}</AvatarFallback>
                    </Avatar>
                  </div>
                  <span className="truncate max-w-[80px]">{conv.name}</span>
                  <PresenceBadge presence={conv.presence} />
                  {conv.unreadCount > 0 && activeConvId !== conv.id && (
                    <Badge
                      variant="destructive"
                      className="size-2 rounded-full p-0"
                    />
                  )}
                </button>
              ))}
            </div>

            {activeConv && (
              <div className="flex flex-col h-[350px]">
                {/* Active Header Bar */}
                <div className="px-3 py-2 bg-muted/20 border-b flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      @{activeConv.username}
                    </span>
                    <PresenceBadge presence={activeConv.presence} />
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                    {activeConv.presence.replaceAll("_", " ")}
                  </span>
                </div>

                {/* Pending Request Banner */}
                {activeConv.pendingRequest && (
                  <div className="p-2.5 bg-primary/10 border-b flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <p className="font-semibold text-foreground">
                        {activeConv.pendingRequest.title}
                      </p>
                      <p className="text-muted-foreground text-[10px]">
                        From @{activeConv.username}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() =>
                          handleActionRequest(activeConv.id, "accept")
                        }
                      >
                        <Check className="size-3 mr-1" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() =>
                          handleActionRequest(activeConv.id, "decline")
                        }
                      >
                        <X className="size-3 mr-1" /> Decline
                      </Button>
                    </div>
                  </div>
                )}

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {activeConv.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[88%] ${
                        msg.isSelf ? "ml-auto items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`p-3 rounded-2xl text-xs space-y-1.5 ${
                          msg.isSelf
                            ? "bg-primary text-primary-foreground rounded-br-none"
                            : "bg-muted text-foreground rounded-bl-none"
                        }`}
                      >
                        {msg.attachment && (
                          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-black/25 text-xs font-medium mb-1 border border-white/10">
                            <div className="size-7 rounded bg-primary/30 flex items-center justify-center shrink-0">
                              <Play className="size-3.5 fill-current" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate">
                                {msg.attachment.title}
                              </p>
                              {msg.attachment.subtitle && (
                                <p className="text-[10px] opacity-75 truncate">
                                  {msg.attachment.subtitle}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        <p>{msg.text}</p>
                      </div>
                      <span className="text-[9px] text-muted-foreground px-1 mt-0.5">
                        {msg.timestamp}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Selected Attachment Pill */}
                {selectedAttachment && (
                  <div className="px-3 py-1 bg-primary/10 border-t flex items-center justify-between text-xs text-primary">
                    <span className="truncate">
                      Attached: {selectedAttachment.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedAttachment(null)}
                      className="hover:opacity-75"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}

                {/* Message Input Bar */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-2 border-t flex items-center gap-2 bg-background"
                >
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                      >
                        <Paperclip className="size-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-52 p-2 space-y-1 text-xs z-50">
                      <p className="font-semibold text-muted-foreground px-2 py-1">
                        Attach Item
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedAttachment({
                            id: "tr-1",
                            subtitle: "140 BPM - WAV Master",
                            title: "Summer Nights Demo.mp3",
                            type: "track",
                          })
                        }
                        className="w-full text-left px-2 py-1.5 hover:bg-muted rounded flex items-center gap-2"
                      >
                        <Music2 className="size-3.5 text-primary" /> Track Demo
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedAttachment({
                            id: "ov-1",
                            subtitle: "8 Bars Open",
                            title: "Open Verse Collab #4",
                            type: "open_verse",
                          })
                        }
                        className="w-full text-left px-2 py-1.5 hover:bg-muted rounded flex items-center gap-2"
                      >
                        <Swords className="size-3.5 text-primary" /> Open Verse
                      </button>
                    </PopoverContent>
                  </Popover>

                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message..."
                    className="h-8 text-xs flex-1"
                  />
                  <Button type="submit" size="icon" className="size-8 shrink-0">
                    <Send className="size-3.5" />
                  </Button>
                </form>
              </div>
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
