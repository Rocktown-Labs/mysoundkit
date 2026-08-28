"use client";
/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp, prefer-named-capture-group */

import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, PanelRightClose, Reply, Video, X } from "lucide-react";
import React, { useMemo, useState } from "react";

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
import type { DbVideoComment } from "@/lib/data-db";
import { useCreateDbVideoComment, useDbVideoComments } from "@/lib/data-db";
import {
  useMeQuery,
  usePeopleSearchQuery,
  useVideoQuery,
  useVideosQuery,
} from "@/lib/soundkit-api-hooks";

const mentionTokenPattern = /(?:^|\s)@([a-z0-9][a-z0-9_-]{0,39})$/iu,
  mentionRenderPattern = /@[a-z0-9][a-z0-9_-]{0,39}/giu,
  renderCommentBody = (body: string) => {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    for (const match of body.matchAll(mentionRenderPattern)) {
      const [mention] = match,
        mentionStart = match.index ?? cursor;
      if (mentionStart > cursor) {
        nodes.push(
          <React.Fragment key={`comment-text-${mentionStart}`}>
            {body.slice(cursor, mentionStart)}
          </React.Fragment>
        );
      }
      nodes.push(
        <span
          className="font-semibold text-primary"
          key={`comment-mention-${mentionStart}`}
        >
          {mention}
        </span>
      );
      cursor = mentionStart + mention.length;
    }
    if (cursor < body.length) {
      nodes.push(
        <React.Fragment key={`comment-text-${body.length}`}>
          {body.slice(cursor)}
        </React.Fragment>
      );
    }
    return nodes.length > 0 ? nodes : body;
  };

function VideoCommentItem({
  comment,
  depth,
  onReply,
  repliesByParent,
}: {
  comment: DbVideoComment;
  depth: number;
  onReply: (comment: DbVideoComment) => void;
  repliesByParent: Map<string, DbVideoComment[]>;
}) {
  const replies = repliesByParent.get(comment.id) ?? [];

  return (
    <div className={depth > 0 ? "ml-6 border-l border-border/50 pl-3" : ""}>
      <div className="flex gap-2.5 rounded-lg border border-border/30 bg-background/50 p-2.5 text-xs">
        <Avatar className="mt-0.5 size-6 shrink-0">
          <AvatarImage
            src={comment.authorAvatarUrl ?? "/soundkit-default-avatar.svg"}
          />
          <AvatarFallback>
            {(comment.authorName ?? "A").slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold">{comment.authorName ?? "User"}</p>
            {comment.authorUsername ? (
              <span className="text-[10px] text-muted-foreground">
                @{comment.authorUsername}
              </span>
            ) : null}
            <span className="text-[10px] text-muted-foreground">
              {new Date(comment.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="mt-1 break-words text-muted-foreground leading-relaxed">
            {renderCommentBody(comment.body)}
          </p>
          <Button
            className="mt-1 h-6 px-1.5 text-[10px] text-muted-foreground"
            onClick={() => onReply(comment)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Reply className="mr-1 size-3" />
            Reply
          </Button>
        </div>
      </div>
      {depth < 4
        ? replies.map((reply) => (
            <div className="mt-2" key={reply.id}>
              <VideoCommentItem
                comment={reply}
                depth={depth + 1}
                onReply={onReply}
                repliesByParent={repliesByParent}
              />
            </div>
          ))
        : null}
    </div>
  );
}

export function VideoDetailPage({ lookupId }: { lookupId: string }) {
  const id = lookupId,
    router = useRouter(),
    [isChatOpen, setIsChatOpen] = useState(true),
    [replyTo, setReplyTo] = useState<DbVideoComment | null>(null),
    { data: video, isPending: isVideoPending } = useVideoQuery(id),
    commentsQuery = useDbVideoComments(id),
    comments = commentsQuery.data,
    repliesByParent = useMemo(() => {
      const grouped = new Map<string, DbVideoComment[]>();
      for (const comment of comments) {
        if (!comment.parentCommentId) {
          continue;
        }
        const replies = grouped.get(comment.parentCommentId) ?? [];
        replies.push(comment);
        grouped.set(comment.parentCommentId, replies);
      }
      return grouped;
    }, [comments]),
    isCommentsPending = commentsQuery.isLoading,
    { data: videoList } = useVideosQuery({
      limit: 12,
      region: "all",
      regionType: "global",
      scope: "public",
    }),
    { data: session } = authClient.useSession(),
    meQuery = useMeQuery();

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
              comments
                .filter((comment) => !comment.parentCommentId)
                .map((comment) => (
                  <VideoCommentItem
                    comment={comment}
                    depth={0}
                    key={comment.id}
                    onReply={setReplyTo}
                    repliesByParent={repliesByParent}
                  />
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
            author={{
              avatarUrl: session?.user.image,
              id: session?.user.id ?? "",
              name: session?.user.name,
              username: meQuery.data?.user.username,
            }}
            onCancelReply={() => setReplyTo(null)}
            onPosted={() => setReplyTo(null)}
            replyTo={replyTo}
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
            videoId={video.id}
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
            videoScope="public"
            viewerCount={Math.trunc(Number(video.viewCount ?? "0")) || 120}
          />
        </div>
      </LiveTwitchShell>
    </div>
  );
}

function VideoCommentForm({
  author,
  onCancelReply,
  onPosted,
  replyTo,
  sessionUserId,
  videoId,
}: {
  author: {
    avatarUrl?: string | null;
    id: string;
    name?: string | null;
    username?: string | null;
  };
  onCancelReply: () => void;
  onPosted: () => void;
  replyTo: DbVideoComment | null;
  sessionUserId: string | null;
  videoId: string;
}) {
  const [draft, setDraft] = useState(""),
    mentionQuery = mentionTokenPattern.exec(draft)?.[1] ?? "",
    mentionSearch = usePeopleSearchQuery(mentionQuery),
    suggestions = (mentionSearch.data ?? []).filter(
      (person) => person.username && person.username.length > 0
    ),
    createComment = useCreateDbVideoComment(videoId, author),
    insertMention = (username: string) => {
      setDraft((current) =>
        current.replace(/(^|\s)@[a-z0-9][a-z0-9_-]{0,39}$/iu, `$1@${username} `)
      );
    },
    submit = async (event: React.FormEvent) => {
      event.preventDefault();
      const body = draft.trim();
      if (!body) {
        return;
      }

      const transaction = createComment.mutate(body, {
        parentCommentId: replyTo?.id ?? null,
      });
      if (!transaction) {
        toast({
          description: "Unable to queue comment.",
          title: "Comment Failed",
          variant: "destructive",
        });
        return;
      }

      try {
        await transaction.isPersisted.promise;
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Your comment could not be posted. Please try again.",
          title: "Comment Failed",
          variant: "destructive",
        });
        return;
      }
      setDraft("");
      onPosted();
      toast({
        description: replyTo
          ? "Your reply was posted."
          : "Your comment was posted.",
        title: replyTo ? "Reply Posted" : "Comment Posted",
      });
    };

  if (!sessionUserId) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
        <Link
          className="font-semibold text-primary hover:underline"
          search={{ redirect: "/dashboard" }}
          to="/login"
        >
          Sign in
        </Link>{" "}
        to comment and chat.
      </div>
    );
  }

  return (
    <div className="relative">
      {replyTo ? (
        <div className="mb-2 flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-[11px]">
          <span className="truncate text-muted-foreground">
            Replying to <strong>{replyTo.authorName ?? "User"}</strong>
          </span>
          <Button
            aria-label="Cancel reply"
            className="size-5"
            onClick={onCancelReply}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : null}
      {mentionQuery.length >= 2 && suggestions.length > 0 ? (
        <ul
          aria-label="Mention suggestions"
          className="absolute right-0 bottom-full left-0 z-10 mb-1 rounded-md border bg-popover p-1 shadow-md"
        >
          {suggestions.slice(0, 6).map((person) => (
            <li key={person.userId}>
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                onClick={() => insertMention(person.username)}
                type="button"
              >
                <Avatar className="size-5">
                  <AvatarImage src={person.avatarUrl ?? undefined} />
                  <AvatarFallback>
                    {person.displayName.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 truncate">
                  <strong>{person.displayName}</strong>
                  <span className="ml-1 text-muted-foreground">
                    @{person.username}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form className="flex items-center gap-2" onSubmit={submit}>
        <Input
          aria-label={replyTo ? "Write a reply" : "Write a comment"}
          className="h-8 text-xs"
          onChange={(event) => setDraft(event.target.value)}
          placeholder={replyTo ? "Write a reply..." : "Say something nice..."}
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
    </div>
  );
}
