"use client";

import { Link } from "@tanstack/react-router";
import {
  Bell,
  Check,
  Copy,
  Headphones,
  Music,
  Plus,
  Radio,
  Share2,
  Users,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { authClient } from "@/lib/auth-client";
import {
  useCreateListeningPartyMutation,
  useProjectsQuery,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";

interface CreateFanPartyDialogProps {
  children?: React.ReactNode;
}

export function CreateFanPartyDialog({ children }: CreateFanPartyDialogProps) {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const isAuthenticated = Boolean(user);

  const projectsQuery = useProjectsQuery();
  const tracksQuery = useTracksQuery();
  const createParty = useCreateListeningPartyMutation();

  const [open, setOpen] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [scheduledStartAt, setScheduledStartAt] = useState("");

  const projects = (projectsQuery.data ?? []).filter(
    (p) => p.projectType !== "single"
  );
  const tracks = tracksQuery.data ?? [];

  const handleCreate = (e: React.FormEvent) => {
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

    const startAt = scheduledStartAt
      ? new Date(scheduledStartAt).toISOString()
      : new Date().toISOString();

    createParty.mutate(
      {
        description: `Fan listening party created by @${user?.name || "listener"}. Chat and synced playback enabled.`,
        playbackMode: "artist_hosted", // Audio tracklist + chat room
        projectId: selectedProjectId,
        scheduledStartAt: startAt,
        title: title.trim() || `${user?.name || "Fan"}'s Listening Room`,
      },
      {
        onSuccess: (res) => {
          const roomId = res.party.liveRoomId || res.party.id;
          setCreatedRoomId(roomId);
          toast({
            description:
              "Your fan listening party is ready! Share the link with friends to listen together.",
            title: "Party Created",
          });
        },
      }
    );
  };

  const copyShareLink = () => {
    if (!createdRoomId) {return;}
    const url = `${window.location.origin}/live/parties/${createdRoomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({
      description: "Party link copied to clipboard.",
      title: "Link Copied",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isAuthenticated) {
    return (
      <Button asChild>
        <Link to="/login">
          <Plus className="mr-2 size-4" />
          Create Fan Party
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
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} ({p.projectType.toUpperCase()})
                    </SelectItem>
                  ))}
                  {/* Fallback option if user has no project of their own */}
                  {projects.length === 0 && (
                    <SelectItem value="project-1">
                      Featured Community Tracklist (Album)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fan-party-time">
                Scheduled Start (Leave blank to open now)
              </Label>
              <Input
                id="fan-party-time"
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
