"use client";
/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp, prefer-named-capture-group */

import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, PanelRightClose, Video } from "lucide-react";
import React, { useState } from "react";

import { VideoCard } from "@/components/explore/video-card";
import type { ExploreVideoCardData } from "@/components/explore/video-card";
import { LiveCreatorPanel } from "@/components/live/live-creator-panel";
import { LiveTwitchShell } from "@/components/live/live-twitch-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SoundKitVideoPlayer } from "@/components/video/soundkit-video-player";
import { toast } from "@/hooks/use-toast";
import { authClient } from "@/lib/auth-client";
import {
  useCreateVideoCommentMutation,
  useVideoCommentsQuery,
  useVideoQuery,
  useVideosQuery,
} from "@/lib/soundkit-api-hooks";

export function VideoDetailPage({ lookupId }: { lookupId: string }) {
  const id = lookupId,
    router = useRouter(),
    [isChatOpen, setIsChatOpen] = useState(true),
    { data: video, isPending: isVideoPending } = useVideoQuery(id),
    { data: comments, isPending: isCommentsPending } =
      useVideoCommentsQuery(id),
    { data: videoList } = useVideosQuery({ limit: 12 }),
    { data: session } = authClient.useSession();

  if (isVideoPending || !video) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <p>Loading video...</p>
      </div>
    );
  }

  const relatedVideos: ExploreVideoCardData[] = (videoList ?? [])
      .filter((entry) => entry.id !== video.id)
      .slice(0, 5)
      .map((entry) => ({
        creator: {
          name: entry.creatorName ?? "SoundKit Artist",
          slug: entry.creatorUsername ?? entry.id,
        },
        duration: entry.duration ?? "",
        id: entry.id,
        playbackPolicy: entry.playbackPolicy === "signed" ? "signed" : "public",
        regionSlug: entry.regionSlug ?? null,
        slug: entry.slug ?? null,
        status: entry.status,
        thumbnail: entry.thumbnailUrl ?? "",
        title: entry.title,
        verifiedOnPlatform: entry.verifiedOnPlatform,
        videoKind: entry.videoKind,
        viewCount: entry.viewCount ?? "0",
      })),
    creatorName = video.creatorName ?? "SoundKit Artist",
    creatorUsername = video.creatorUsername ?? "soundkit-artist",
    chatPanel = (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={() => setIsChatOpen(false)}
              size="icon"
              title="Collapse Chat"
              type="button"
              variant="ghost"
            >
              <PanelRightClose className="size-4" />
            </Button>
            <h3 className="font-semibold text-sm">Comments &amp; Chat</h3>
          </div>
          <Badge variant="secondary">{comments?.length ?? 0}</Badge>
        </div>

        {/* Scrollable Comments List */}
        <ScrollArea className="flex-1 min-h-0 px-4 py-3">
          <div className="space-y-3">
            {isCommentsPending && (
              <p className="text-xs text-muted-foreground">
                Loading comments...
              </p>
            )}
            {comments && comments.length > 0 ? (
              comments.map((c) => (
                <div
                  className="flex gap-2.5 rounded-lg border border-border/30 bg-background/50 p-2.5 text-xs"
                  key={c.id}
                >
                  <Avatar className="size-6 shrink-0 mt-0.5">
                    <AvatarImage
                      src={c.authorAvatarUrl ?? "/diverse-user-avatars.png"}
                    />
                    <AvatarFallback>
                      {(c.authorName ?? "A").slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold">{c.authorName ?? "User"}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground leading-relaxed break-words">
                      {c.body}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No comments yet. Start the conversation!
              </p>
            )}
          </div>
        </ScrollArea>

        {/* Bottom Comment Form */}
        <div className="border-t border-border/40 p-3 shrink-0 bg-background/30">
          <VideoCommentForm
            sessionUserId={session?.user.id ?? null}
            videoId={video.id}
          />
        </div>

        {/* Related Videos Strip */}
        {relatedVideos.length > 0 && (
          <div className="border-t border-border/40 px-3 py-2.5 shrink-0 bg-muted/10">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                Related Videos
              </p>
              <Link
                className="text-[10px] text-primary hover:underline"
                to="/videos"
              >
                View All
              </Link>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {relatedVideos.slice(0, 3).map((item) => (
                <Link
                  className="flex items-center gap-2 rounded-lg border border-border/30 p-1.5 transition-colors hover:bg-muted/50 text-xs"
                  key={item.id}
                  params={{ id: item.id }}
                  to="/videos/$id"
                >
                  <img
                    alt={item.title}
                    className="size-8 rounded object-cover shrink-0"
                    src={item.thumbnail || "/soundkit-default-banner.svg"}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-xs">
                      {item.title}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {item.creator.name}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    ),
    videoNode = (
      <div className="relative aspect-video w-full bg-black">
        {video.muxPlaybackId ||
        video.externalPlaybackUrl ||
        video.thumbnailUrl ? (
          <SoundKitVideoPlayer
            externalPlaybackUrl={video.externalPlaybackUrl}
            muxPlaybackId={video.muxPlaybackId}
            posterUrl={video.thumbnailUrl || "/soundkit-default-banner.svg"}
            title={video.title}
            verifiedOnPlatform={video.verifiedOnPlatform}
          />
        ) : (
          <div className="flex size-full items-center justify-center p-6 text-muted-foreground">
            <Video className="mr-2 size-6 text-muted-foreground" />
            Video processing or offline
          </div>
        )}
      </div>
    );

  return (
    <div className="h-full min-h-0 w-full">
      <LiveTwitchShell
        chatPanel={chatPanel}
        defaultChatOpen={true}
        isChatOpen={isChatOpen}
        onChatOpenChange={setIsChatOpen}
        videoNode={videoNode}
      >
        <div className="pt-2">
          <div className="mb-2">
            <Button
              className="px-0 h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => router.history.back()}
              size="sm"
              variant="ghost"
            >
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Button>
          </div>

          <LiveCreatorPanel
            creator={{
              displayName: creatorName,
              followersCount: 5400,
              username: creatorUsername,
            }}
            genre={video.genre}
            isLive={video.status === "live"}
            statusLabel={
              video.verifiedOnPlatform
                ? "SoundKit Verified Master"
                : "Community Video"
            }
            title={video.title}
            viewerCount={Math.trunc(Number(video.viewCount ?? "0")) || 120}
          />
        </div>
      </LiveTwitchShell>
    </div>
  );
}

function VideoCommentForm({
  sessionUserId,
  videoId,
}: {
  sessionUserId: string | null;
  videoId: string;
}) {
  const [draft, setDraft] = useState(""),
    createComment = useCreateVideoCommentMutation(),
    submit = async (event: React.FormEvent) => {
      event.preventDefault();
      const body = draft.trim();
      if (!body) {
        return;
      }

      await createComment.mutateAsync({ body, videoId });
      setDraft("");
      toast({
        description: "Your comment was posted.",
        title: "Comment Posted",
      });
    };

  if (!sessionUserId) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
        <Link
          className="font-semibold text-primary hover:underline"
          to="/login"
        >
          Sign in
        </Link>{" "}
        to comment and chat.
      </div>
    );
  }

  return (
    <form className="flex items-center gap-2" onSubmit={submit}>
      <Input
        className="h-8 text-xs"
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Say something nice..."
        value={draft}
      />
      <Button
        className="h-8 px-3 text-xs"
        disabled={draft.trim().length === 0 || createComment.isPending}
        size="sm"
        type="submit"
      >
        Post
      </Button>
    </form>
  );
}
