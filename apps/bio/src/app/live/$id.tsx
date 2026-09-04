/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Radio,
  Share2,
  Users,
} from "lucide-react";
import React, { useState } from "react";

import {
  buildSoundKitWebUrl,
  loadBioLiveExperience,
  SOUNDKIT_BIO_URL,
  toAbsoluteBioUrl,
} from "@/lib/api";
import type { BioLiveExperienceDetail } from "@/lib/api";

export const Route = createFileRoute("/live/$id")({
  component: BioLiveDetailPage,
  head: ({ loaderData, params }) => {
    const live = loaderData as unknown as BioLiveExperienceDetail | null,
      title = live
        ? `${live.title} — Live on SoundKit.bio`
        : "Live Stream — SoundKit.bio",
      description =
        live?.description ||
        (live
          ? `Join ${live.hostDisplayName || live.creatorUsername} live on SoundKit.`
          : "Live streaming experiences on SoundKit.bio."),
      canonical = `${SOUNDKIT_BIO_URL}/live/${encodeURIComponent(params.id)}`,
      image = toAbsoluteBioUrl("/soundkit-social-card.png");

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
  loader: async ({ params }) => await loadBioLiveExperience(params.id),
});

function BioLiveDetailPage() {
  const live = Route.useLoaderData() as BioLiveExperienceDetail | null,
    [copiedLink, setCopiedLink] = useState(false);

  if (!live) {
    return <LiveNotFound />;
  }

  const isCurrentlyLive = live.status === "live",
    soundKitLivePath =
      live.kind === "battle"
        ? `/live/battles/${encodeURIComponent(live.id)}`
        : live.kind === "party"
          ? `/live/parties/${encodeURIComponent(live.id)}`
          : `/live/streams/${encodeURIComponent(live.id)}`,
    soundKitLiveUrl = buildSoundKitWebUrl(
      soundKitLivePath,
      live.creatorUsername || undefined
    ),
    handleShareClick = () => {
      if (typeof window !== "undefined") {
        navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2200);
      }
    };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10 space-y-8">
      {/* Back to Creator link */}
      <div>
        {live.creatorUsername ? (
          <Link
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
            params={{ username: live.creatorUsername }}
            to="/$username"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to @{live.creatorUsername}</span>
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

      {/* Main Live Card */}
      <div className="overflow-hidden rounded-3xl border border-border/50 bg-card/60 backdrop-blur-2xl shadow-2xl space-y-6">
        {/* Stream Canvas / Hero Surface */}
        <div className="relative aspect-video w-full overflow-hidden bg-black flex items-center justify-center">
          {live.streamPlaybackUrl ? (
            <video
              autoPlay
              className="size-full object-contain"
              controls
              playsInline
              src={live.streamPlaybackUrl}
            >
              <track kind="captions" />
            </video>
          ) : (
            <div className="relative size-full flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="relative z-10 flex flex-col items-center space-y-3">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-red-500/20 text-red-400 border border-red-500/40">
                  <Radio className="size-8 animate-pulse" />
                </div>

                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/20 px-3 py-1 text-xs font-bold text-red-400">
                    <span className="size-2 rounded-full bg-red-500 animate-ping" />
                    <span>
                      {isCurrentlyLive ? "LIVE NOW" : "STREAM OFFLINE"}
                    </span>
                  </div>
                  <h2 className="font-playfair text-2xl sm:text-3xl font-medium text-foreground pt-1">
                    {live.title}
                  </h2>
                </div>

                <a
                  className="inline-flex items-center gap-2 rounded-full bg-red-500 px-6 py-3 font-bold text-sm text-white shadow-xl shadow-red-500/25 hover:bg-red-600 hover:scale-105 active:scale-95 transition-all"
                  href={soundKitLiveUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span>Join Live Stream Room</span>
                  <ExternalLink className="size-4" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Live Meta Info */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                    isCurrentlyLive
                      ? "border border-red-500/40 bg-red-500/20 text-red-400"
                      : "border border-border/50 bg-white/5 text-muted-foreground"
                  }`}
                >
                  {live.status.toUpperCase()}
                </span>
                {live.genre ? (
                  <span className="rounded-full border border-border/50 bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    {live.genre}
                  </span>
                ) : null}
                {isCurrentlyLive ? (
                  <span className="flex items-center gap-1 font-mono text-xs text-red-400">
                    <Users className="size-3.5" />
                    <span>{live.viewerCount.toLocaleString()} watching</span>
                  </span>
                ) : null}
              </div>

              <h1 className="font-playfair text-2xl sm:text-4xl font-medium tracking-tight text-foreground">
                {live.title}
              </h1>

              {/* Host link */}
              <div className="pt-1">
                {live.creatorUsername ? (
                  <Link
                    className="font-semibold text-sm sm:text-base text-primary hover:underline"
                    params={{ username: live.creatorUsername }}
                    to="/$username"
                  >
                    Host: {live.hostDisplayName || `@${live.creatorUsername}`}
                  </Link>
                ) : (
                  <span className="font-semibold text-sm text-foreground">
                    Host: {live.hostDisplayName || "SoundKit Creator"}
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
                className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-red-600 transition-colors"
                href={soundKitLiveUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span>Live Room</span>
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>

          {live.description ? (
            <div className="rounded-2xl border border-border/40 bg-white/5 p-4 text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {live.description}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LiveNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground">
        <Radio className="size-7" />
      </div>
      <div className="space-y-1">
        <h2 className="font-playfair text-2xl font-semibold text-foreground">
          Live Stream Not Found
        </h2>
        <p className="text-xs text-muted-foreground">
          This live broadcast is offline or no longer available.
        </p>
      </div>
      <Link
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
        to="/"
      >
        <span>Discover Artists & Music</span>
      </Link>
    </div>
  );
}
