"use client";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Copy, Headphones, Plus, Radio, Users } from "lucide-react";
import React, { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { API_V1_URL } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import {
  useCreateListeningPartyMutation,
  useMeEntitlementsQuery,
} from "@/lib/soundkit-api-hooks";

interface CreateFanPartyDialogProps {
  children?: React.ReactNode;
}

const padDateTimePart = (value: number) => value.toString().padStart(2, "0"),
  toLocalDateTimeInputValue = (date: Date) =>
    `${date.getFullYear()}-${padDateTimePart(date.getMonth() + 1)}-${padDateTimePart(date.getDate())}T${padDateTimePart(date.getHours())}:${padDateTimePart(date.getMinutes())}`;

export function CreateFanPartyDialog({ children }: CreateFanPartyDialogProps) {
  const { data: session } = authClient.useSession(),
    user = session?.user,
    isAuthenticated = Boolean(user),
    entitlementsQuery = useMeEntitlementsQuery(),
    createParty = useCreateListeningPartyMutation(),
    sourcesQuery = useQuery({
      enabled: isAuthenticated,
      queryFn: async () => {
        const response = await fetch(
          `${API_V1_URL}/listening-parties/sources`,
          {
            credentials: "include",
          }
        );
        if (!response.ok) {
          throw new Error("Could not load listening party sources.");
        }
        return (await response.json()) as {
          accountType: "artist" | "fan";
          playlists: { id: string; title: string }[];
          projects: { id: string; releaseDate: string | null; title: string }[];
        };
      },
      queryKey: ["listening-party-sources"],
    }),
    [open, setOpen] = useState(false),
    [createdRoomId, setCreatedRoomId] = useState<string | null>(null),
    [copied, setCopied] = useState(false),
    [selectedProjectId, setSelectedProjectId] = useState<string>(""),
    [title, setTitle] = useState(""),
    [scheduledStartAt, setScheduledStartAt] = useState(""),
    projects = sourcesQuery.data?.projects ?? [],
    playlists = sourcesQuery.data?.playlists ?? [],
    handleCreate = (e: React.FormEvent) => {
      e.preventDefault();

      if (!selectedProjectId) {
        toast({
          description:
            "Please select an EP, album, or playlist to listen to with friends.",
          title: "Tracklist required",
          variant: "destructive",
        });
        return;
      }

      const startAt = new Date(scheduledStartAt).toISOString(),
        [sourceType, sourceId] = selectedProjectId.split(":", 2);

      createParty.mutate(
        {
          description: `Fan listening party created by @${user?.name || "listener"}. Chat and synced playback enabled.`,
          playbackMode: "artist_hosted",
          playlistId: sourceType === "playlist" ? sourceId : undefined,
          projectId: sourceType === "project" ? sourceId : undefined,
          scheduledStartAt: startAt,
          title: title.trim() || `${user?.name || "Fan"}'s Listening Room`,
        },
        {
          onSuccess: (res) => {
            const roomId = res.liveRoomId || res.id;
            setCreatedRoomId(roomId);
            toast({
              description:
                "Your fan listening party is ready! Share the link with friends to listen together.",
              title: "Party Created",
            });
          },
        }
      );
    },
    copyShareLink = () => {
      if (!createdRoomId) {
        return;
      }
      const url = `${window.location.origin}/live/parties/${createdRoomId}`;
      void navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true);
          toast({
            description: "Party link copied to clipboard.",
            title: "Link Copied",
          });
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {});
    };

  if (!isAuthenticated) {
    return (
      <Button asChild>
        <Link search={{ redirect: "/live/parties" }} to="/login">
          <Plus className="mr-2 size-4" />
          Create Fan Party
        </Link>
      </Button>
    );
  }

  if (sourcesQuery.data?.accountType === "artist") {
    return (
      <Button asChild>
        <Link to="/dashboard/live/parties">
          <Plus className="mr-2 size-4" />
          Schedule Release Party
        </Link>
      </Button>
    );
  }

  if (!entitlementsQuery.data?.isPremium) {
    return (
      <Button asChild>
        <Link to="/pricing">
          <Plus className="mr-2 size-4" />
          Upgrade to Host
        </Link>
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) {
          setCreatedRoomId(null);
          setTitle("");
          setSelectedProjectId("");
        }
      }}
    >
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="mr-2 size-4" />
            Create Fan Party
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Headphones className="size-5 text-primary" />
            Create Fan Listening Party
          </DialogTitle>
          <DialogDescription>
            Host a live room for an album or playlist where fans can listen,
            chat, and follow synced lyrics. Never includes video.
          </DialogDescription>
        </DialogHeader>

        {createdRoomId ? (
          <div className="space-y-4 py-3">
            <div className="rounded-lg border bg-emerald-500/10 border-emerald-500/30 p-4 text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-2 font-semibold">
                <Check className="size-5 text-emerald-500" />
                Listening Party Created!
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Your listening room is ready. Notifications are active and fans
                can join in real-time.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Party Share Link</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${typeof window === "undefined" ? "" : window.location.origin}/live/parties/${createdRoomId}`}
                  className="font-mono text-xs"
                />
                <Button size="icon" variant="outline" onClick={copyShareLink}>
                  {copied ? (
                    <Check className="size-4 text-emerald-500" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button asChild onClick={() => setOpen(false)}>
                <Link to="/live/parties/$id" params={{ id: createdRoomId }}>
                  <Radio className="mr-2 size-4" />
                  Join Room Now
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <form className="space-y-4 pt-2" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="fan-party-title">Party Name</Label>
              <Input
                id="fan-party-title"
                placeholder="Midnight EP Fan Listening Room"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fan-party-project">
                Select Album, EP, or Playlist
              </Label>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
                required
              >
                <SelectTrigger id="fan-party-project">
                  <SelectValue placeholder="Choose project or playlist" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem
                      key={`project:${project.id}`}
                      value={`project:${project.id}`}
                    >
                      {project.title} · Project
                    </SelectItem>
                  ))}
                  {playlists.map((playlist) => (
                    <SelectItem
                      key={`playlist:${playlist.id}`}
                      value={`playlist:${playlist.id}`}
                    >
                      {playlist.title} · Playlist
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fan-party-time">Scheduled Start</Label>
              <Input
                id="fan-party-time"
                min={toLocalDateTimeInputValue(new Date())}
                required
                type="datetime-local"
                value={scheduledStartAt}
                onChange={(e) => setScheduledStartAt(e.target.value)}
              />
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <Users className="size-4 text-primary" /> Chat Only Room
              </span>
              <Badge variant="outline">No Video Camera</Badge>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createParty.isPending}>
                <Plus className="mr-2 size-4" />
                {createParty.isPending ? "Creating..." : "Create Party"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
