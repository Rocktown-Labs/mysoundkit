import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Eye, Radio, ShieldCheck, Video } from "lucide-react";
import { useState } from "react";

import { VideoCard } from "@/components/explore/video-card";
import type { ExploreVideoCardData } from "@/components/explore/video-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SoundKitVideoPlayer } from "@/components/video/soundkit-video-player";
import { authClient } from "@/lib/auth-client";
import {
  useCreateVideoCommentMutation,
  useVideoCommentsQuery,
  useVideoQuery,
  useVideosQuery,
} from "@/lib/soundkit-api-hooks";

export function VideoDetailPage({ lookupId }: { lookupId: string }) {
  const id = lookupId;
  const router = useRouter();
  const { data: video, isPending: isVideoPending } = useVideoQuery(id);
  const { data: comments, isPending: isCommentsPending } =
    useVideoCommentsQuery(id);
  const { data: videoList } = useVideosQuery({ limit: 12 });
  const { data: session } = authClient.useSession();

  if (isVideoPending || !video) {
    return (
      <div className="space-y-6 px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.history.back()}
          className="w-fit"
        >
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
        <p className="text-muted-foreground">Loading video…</p>
      </div>
    );
  }

  const relatedVideos: ExploreVideoCardData[] = (videoList ?? [])
    .filter((entry) => entry.id !== video.id)
    .slice(0, 3)
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
    }));

  return (
    <div className="space-y-6 px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.history.back()}
        className="w-fit"
      >
        <ArrowLeft className="mr-2 size-4" />
        Back
      </Button>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={video.status === "live" ? "destructive" : "secondary"}
              >
                {video.status === "live"
                  ? "Live"
                  : video.videoKind.replaceAll("_", " ")}
              </Badge>
              <Badge className="bg-black/80 text-white">
                {video.verifiedOnPlatform ? (
                  <>
                    <ShieldCheck className="mr-1 size-3.5 text-emerald-400" />
                    SoundKit Verified
                  </>
                ) : (
                  "External Source"
                )}
              </Badge>
              {video.genre ? (
                <Badge variant="outline">{video.genre}</Badge>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {video.creatorName ?? "SoundKit Artist"}
              </p>
              <h1 className="text-2xl font-bold md:text-4xl">{video.title}</h1>
            </div>

            {video.thumbnailUrl ? (
              <SoundKitVideoPlayer
                externalPlaybackUrl={video.externalPlaybackUrl}
                muxPlaybackId={video.muxPlaybackId}
                posterUrl={video.thumbnailUrl}
                title={video.title}
                verifiedOnPlatform={video.verifiedOnPlatform}
              />
            ) : (
              <Card className="border-border/50 bg-card/50">
                <CardContent className="flex aspect-video items-center justify-center p-6 text-muted-foreground">
                  <Video className="mr-2 size-5" />
                  Video processing
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap gap-3">
              {video.externalPlaybackUrl ? (
                <Button asChild={true}>
                  <a
                    href={video.externalPlaybackUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Watch Source Video
                  </a>
                </Button>
              ) : (
                <Button disabled={video.muxPlaybackId === null}>
                  Play on SoundKit
                </Button>
              )}
            </div>
          </div>

          <Card className="border-border/50 bg-card/50">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="size-4" />
                  {video.viewCount ?? "0"} views
                </span>
                <span className="flex items-center gap-1">
                  {video.status === "live" ? (
                    <Radio className="size-4 text-red-500" />
                  ) : (
                    <Video className="size-4" />
                  )}
                  {video.duration}
                </span>
              </div>
              {video.description ? (
                <p className="text-sm text-muted-foreground md:text-base">
                  {video.description}
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {video.verifiedOnPlatform
                  ? "This asset was uploaded directly to SoundKit and will receive the verified treatment anywhere it appears in the app."
                  : "This asset is linked from an external host. Fans can still discover it on SoundKit, but it is not marked as an on-platform upload."}
              </p>
            </CardContent>
          </Card>

          <CommentSection
            comments={comments}
            isPending={isCommentsPending}
            sessionUserId={session?.user.id ?? null}
            videoId={video.id}
          />
        </div>

        <aside className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">More Videos</h2>
            <Link to="/videos" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {relatedVideos.map((relatedVideo) => (
              <VideoCard
                key={relatedVideo.id}
                compact={true}
                video={relatedVideo}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function CommentSection({
  comments,
  isPending,
  sessionUserId,
  videoId,
}: {
  comments?: {
    authorAvatarUrl?: string | null;
    authorName?: string | null;
    body: string;
    createdAt: string;
    id: string;
    userId: string;
  }[];
  isPending: boolean;
  sessionUserId: string | null;
  videoId: string;
}) {
  const [draft, setDraft] = useState("");
  const createComment = useCreateVideoCommentMutation();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) {
      return;
    }

    await createComment.mutateAsync({ body, videoId });
    setDraft("");
  };

  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Comments</h2>

        {sessionUserId ? (
          <form className="space-y-2" onSubmit={submit}>
            <Label htmlFor="comment-body" className="sr-only">
              Write a comment
            </Label>
            <Input
              id="comment-body"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Add a comment…"
              value={draft}
            />
            <Button
              disabled={draft.trim().length === 0 || createComment.isPending}
              size="sm"
              type="submit"
            >
              Post
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>{" "}
            to join the conversation.
          </p>
        )}

        {isPending ? (
          <p className="text-sm text-muted-foreground">Loading comments…</p>
        ) : (comments && comments.length > 0 ? (
          <ul className="space-y-4">
            {comments.map((comment) => (
              <li
                className="flex gap-3 border-t border-border/50 pt-4"
                key={comment.id}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {comment.authorName ?? "SoundKit Artist"}
                  </p>
                  <p className="text-sm">{comment.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No comments yet. Start the conversation.
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
