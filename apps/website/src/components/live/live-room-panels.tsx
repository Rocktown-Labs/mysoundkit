import { MessageSquare, Music2, Send } from "lucide-react";
import { useState } from "react";

import type { LiveRoomState, LiveRoomTrack } from "@/lib/live-room";

import { AppImage } from "../ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";

interface LiveChatPanelProps {
  disabled?: boolean;
  messages: LiveRoomState["chat"];
  onSend: (message: string) => void;
}

export function LiveChatPanel({
  disabled,
  messages,
  onSend,
}: LiveChatPanelProps) {
  const [message, setMessage] = useState(""),

   send = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    onSend(trimmedMessage);
    setMessage("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="size-4" />
          Live Chat
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {messages.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-80 pr-3">
          <div className="space-y-3">
            {messages.map((chatMessage) => (
              <div className="flex gap-3" key={chatMessage.id}>
                <Avatar className="size-8">
                  <AvatarImage src="/diverse-user-avatars.png" />
                  <AvatarFallback>
                    {chatMessage.userName.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 rounded-lg bg-muted p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{chatMessage.userName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(chatMessage.sentAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {chatMessage.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="flex gap-2">
          <Input
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
            disabled={disabled || !message.trim()}
            onClick={send}
            size="icon"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
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
