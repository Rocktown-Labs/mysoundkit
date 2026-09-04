/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Eye,
  Share2,
  Video,
} from "lucide-react";
import React, { useState } from "react";

import {
  buildSoundKitWebUrl,
  loadBioVideo,
  SOUNDKIT_BIO_URL,
  toAbsoluteBioUrl,
} from "@/lib/api";
import type { BioVideoDetail } from "@/lib/api";

export const Route = createFileRoute("/videos/$id")({
  component: BioVideoDetailPage,
  head: ({ loaderData, params }) => {
    const video = loaderData as unknown as BioVideoDetail | null,
      title = video
        ? `${video.title} by ${video.creatorName} — SoundKit.bio`
        : "Video — SoundKit.bio",
      description =
        video?.description ||
        (video
          ? `Watch ${video.title} by ${video.creatorName} on SoundKit.`
          : "Discover artist videos on SoundKit.bio."),
      image = toAbsoluteBioUrl(
        video?.thumbnailUrl || "/soundkit-social-card.png"
      ),
      canonical = `${SOUNDKIT_BIO_URL}/videos/${encodeURIComponent(params.id)}`;

    return {
      links: [{ href: canonical, rel: "canonical" }],
      meta: [
        { title },
        { content: description, name: "description" },
        { content: canonical, property: "og:url" },
        { content: "video.other", property: "og:type" },
        { content: title, property: "og:title" },
        { content: description, property: "og:description" },
        { content: "SoundKit Bio", property: "og:site_name" },
        { content: image, property: "og:image" },
        { content: "summary_large_image", name: "twitter:card" },
        { content: title, name: "twitter:title" },
        { content: description, name: "twitter:description" },
        { content: image, name: "twitter:image" },
      ],
    };
  },
  loader: async ({ params }) => await loadBioVideo(params.id),
});

function BioVideoDetailPage() {
  const video = Route.useLoaderData() as BioVideoDetail | null,
    [copiedLink, setCopiedLink] = useState(false);

  if (!video) {
    return <VideoNotFound />;
  }

  const handleShareClick = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    }
  };

  const soundKitVideoUrl = buildSoundKitWebUrl(
    `/videos/${encodeURIComponent(video.id)}`,
    video.creatorUsername || undefined
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10 space-y-8">
      {/* Back to Creator link */}
      <div>
        {video.creatorUsername ? (
          <Link
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
            params={{ username: video.creatorUsername }}
            to="/$username"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to @{video.creatorUsername}</span>
          </Link>
        ) : (
          <Link
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
            to="/"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Artists</span>
          </Link>
        )}
      </div>

      {/* Video Player Card */}
      <div className="overflow-hidden rounded-3xl border border-border/50 bg-card/60 backdrop-blur-2xl shadow-2xl space-y-6">
        {/* Video Surface */}
        <div className="relative aspect-video w-full overflow-hidden bg-black flex items-center justify-center">
          {video.muxPlaybackId && video.playbackPolicy !== "signed" ? (
            <video
              className="size-full object-contain"
              controls
              playsInline
              poster={
                video.thumbnailUrl ||
                `https://image.mux.com/${video.muxPlaybackId}/thumbnail.png?width=1280`
              }
              preload="metadata"
              src={`https://stream.mux.com/${video.muxPlaybackId}/medium.mp4`}
            >
              <track kind="captions" />
            </video>
          ) : video.externalPlaybackUrl ? (
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="size-full border-0"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-presentation"
              src={video.externalPlaybackUrl}
              title={video.title}
            />
          ) : video.thumbnailUrl ? (
            <div className="relative size-full">
              <img
                alt={video.title}
                className="size-full object-cover"
                src={video.thumbnailUrl}
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <a
                  className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-sm text-primary-foreground shadow-xl hover:scale-105 transition-transform"
                  href={soundKitVideoUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Video className="size-5" />
                  <span>Watch on SoundKit</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-3 text-muted-foreground">
              <Video className="size-12" />
              <p className="text-sm">
                Video media playback is ready on SoundKit.
              </p>
              <a
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground"
                href={soundKitVideoUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span>Open in SoundKit</span>
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Video Meta Info */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  {video.videoKind.replaceAll("_", " ")}
                </span>
                {video.genre ? (
                  <span className="rounded-full border border-border/50 bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    {video.genre}
                  </span>
                ) : null}
                {video.duration ? (
                  <span className="font-mono text-xs text-muted-foreground">
                    {video.duration}
                  </span>
                ) : null}
              </div>

              <h1 className="font-playfair text-2xl sm:text-4xl font-medium tracking-tight text-foreground">
                {video.title}
              </h1>

              {/* Creator info link */}
              <div className="flex items-center gap-3 pt-1">
                {video.creatorUsername ? (
                  <Link
                    className="flex items-center gap-2.5 group"
                    params={{ username: video.creatorUsername }}
                    to="/$username"
                  >
                    <div className="relative size-8 shrink-0 overflow-hidden rounded-full border border-border/40 bg-black/40">
                      {video.creatorAvatarUrl ? (
                        <img
                          alt={video.creatorName}
                          className="size-full object-cover"
                          src={video.creatorAvatarUrl}
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center font-bold text-xs text-primary">
                          {video.creatorName[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                      {video.creatorName}
                    </span>
                  </Link>
                ) : (
                  <span className="font-semibold text-sm text-foreground">
                    {video.creatorName}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/5 px-4 py-2 text-xs sm:text-sm font-semibold text-foreground hover:bg-white/10 transition-all"
                onClick={handleShareClick}
                type="button"
              >
                {copiedLink ? (
                  <>
                    <Check className="size-4 text-primary" />
                    <span className="text-primary font-bold">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="size-4 text-muted-foreground" />
                    <span>Share</span>
                  </>
                )}
              </button>

              <a
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
                href={soundKitVideoUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span>SoundKit</span>
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>

          {video.description ? (
            <div className="rounded-2xl border border-border/40 bg-white/5 p-4 text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {video.description}
            </div>
          ) : null}

          {video.viewCount ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <Eye className="size-3.5" />
              <span>{video.viewCount} views</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VideoNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground">
        <Video className="size-7" />
      </div>
      <div className="space-y-1">
        <h2 className="font-playfair text-2xl font-semibold text-foreground">
          Video Not Found
        </h2>
        <p className="text-xs text-muted-foreground">
          The requested video could not be found or is no longer available.
        </p>
      </div>
      <Link
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
        to="/"
      >
        <span>Discover Artists & Videos</span>
      </Link>
    </div>
  );
}
