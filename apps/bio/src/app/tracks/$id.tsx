/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Disc3,
  ExternalLink,
  Headphones,
  Music,
  Pause,
  Play,
  Share2,
  Youtube,
} from "lucide-react";
import React, { useState } from "react";

import { useBioAudioPlayer } from "@/components/bio-audio-player";
import {
  buildSoundKitWebUrl,
  isSafeExternalUrl,
  loadBioTrack,
  SOUNDKIT_BIO_URL,
  toAbsoluteBioUrl,
} from "@/lib/api";
import type { BioTrack } from "@/lib/api";

export const Route = createFileRoute("/tracks/$id")({
  component: BioTrackDetailPage,
  head: ({ loaderData, params }) => {
    const track = loaderData as unknown as BioTrack | null,
      title = track
        ? `${track.title} by ${track.artistName} — SoundKit.bio`
        : "Track Details — SoundKit.bio",
      description = track
        ? `Listen to ${track.title} by ${track.artistName} on SoundKit and streaming platforms.`
        : "Discover tracks on SoundKit.bio.",
      image = toAbsoluteBioUrl(
        track?.coverArtUrl || "/soundkit-social-card.png"
      ),
      canonical = `${SOUNDKIT_BIO_URL}/tracks/${encodeURIComponent(params.id)}`;

    return {
      links: [{ href: canonical, rel: "canonical" }],
      meta: [
        { title },
        { content: description, name: "description" },
        { content: canonical, property: "og:url" },
        { content: "music.song", property: "og:type" },
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
  loader: async ({ params }) => await loadBioTrack(params.id),
});

function BioTrackDetailPage() {
  const track = Route.useLoaderData() as unknown as BioTrack | null,
    [copiedLink, setCopiedLink] = useState(false),
    { currentTrack, isPlaying, playTrack, togglePlay } = useBioAudioPlayer();

  if (!track) {
    return <TrackNotFound />;
  }

  const isThisPlaying = isPlaying && currentTrack?.id === track.id,
    handlePlayToggle = () => {
      if (currentTrack?.id === track.id) {
        togglePlay();
      } else {
        playTrack(track, [track]);
      }
    },
    handleShareClick = () => {
      if (typeof window !== "undefined") {
        navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2200);
      }
    },
    soundKitTrackUrl = buildSoundKitWebUrl(
      `/tracks/${encodeURIComponent(track.id)}`,
      track.artistUsername ?? undefined
    ),
    artistBioUrl = track.artistUsername
      ? `/${encodeURIComponent(track.artistUsername)}`
      : "/";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10 space-y-8">
      {/* Back to Artist link */}
      <div>
        <a
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
          href={artistBioUrl}
        >
          <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
          <span>
            {track.artistUsername
              ? `Back to @${track.artistUsername}`
              : "Back to Artist"}
          </span>
        </a>
      </div>

      {/* Main Track Presentation Card */}
      <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/60 p-6 sm:p-10 backdrop-blur-2xl shadow-2xl">
        {/* Glow backdrop */}
        {track.coverArtUrl ? (
          <div className="pointer-events-none absolute inset-0 opacity-25 blur-3xl">
            <img
              alt=""
              className="size-full object-cover"
              src={track.coverArtUrl}
            />
          </div>
        ) : (
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-96 rounded-full bg-primary/15 blur-3xl" />
        )}

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
          {/* Large Artwork with Play Trigger */}
          <div className="relative group shrink-0">
            <div className="size-56 sm:size-64 md:size-72 overflow-hidden rounded-2xl border border-border/60 bg-black/40 shadow-2xl">
              {track.coverArtUrl ? (
                <img
                  alt={track.title}
                  className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                  src={track.coverArtUrl}
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Music className="size-16 text-muted-foreground/40" />
                </div>
              )}
            </div>

            {/* Play Button Overlay */}
            <button
              aria-label={isThisPlaying ? "Pause playback" : "Play track"}
              className={`absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-all ${
                isThisPlaying
                  ? "opacity-100 scale-100 ring-4 ring-white/30"
                  : "opacity-90 sm:opacity-0 sm:group-hover:opacity-100 scale-95 sm:group-hover:scale-100"
              } hover:scale-110 active:scale-95`}
              onClick={handlePlayToggle}
              type="button"
            >
              {isThisPlaying ? (
                <Pause className="size-8 fill-current" />
              ) : (
                <Play className="ml-1 size-8 fill-current" />
              )}
            </button>
          </div>

          {/* Details & Actions */}
          <div className="min-w-0 flex-1 text-center md:text-left space-y-6">
            <div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  {track.genre || "Music Track"}
                </span>
                {track.duration ? (
                  <span className="font-mono text-xs text-muted-foreground">
                    {track.duration}
                  </span>
                ) : null}
              </div>

              <h1 className="mt-3 font-playfair text-3xl sm:text-5xl font-medium tracking-tight text-foreground">
                {track.title}
              </h1>

              <div className="mt-2">
                <a
                  className="font-semibold text-base sm:text-lg text-primary hover:underline"
                  href={artistBioUrl}
                >
                  {track.artistName}
                </a>
              </div>
            </div>

            {/* Audio Properties / Metadata */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs">
              {track.bpm ? (
                <div className="rounded-xl border border-border/50 bg-white/5 px-3 py-1.5 font-mono">
                  <span className="text-muted-foreground">BPM:</span>{" "}
                  <span className="font-bold text-foreground">{track.bpm}</span>
                </div>
              ) : null}

              {track.musicalKey ? (
                <div className="rounded-xl border border-border/50 bg-white/5 px-3 py-1.5 font-mono">
                  <span className="text-muted-foreground">Key:</span>{" "}
                  <span className="font-bold text-foreground">
                    {track.musicalKey}
                  </span>
                </div>
              ) : null}

              {track.plays ? (
                <div className="rounded-xl border border-border/50 bg-white/5 px-3 py-1.5 font-mono">
                  <span className="text-muted-foreground">Plays:</span>{" "}
                  <span className="font-bold text-foreground">
                    {track.plays.toLocaleString()}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
              <button
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90 hover:scale-105 active:scale-95 transition-all"
                onClick={handlePlayToggle}
                type="button"
              >
                {isThisPlaying ? (
                  <>
                    <Pause className="size-4 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="size-4 fill-current" />
                    <span>Play on SoundKit</span>
                  </>
                )}
              </button>

              <button
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/5 px-4 py-3 text-xs sm:text-sm font-semibold text-foreground hover:bg-white/10 transition-all"
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
                    <Share2 className="size-4" />
                    <span>Share Track</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Streaming Platform Outbound Links */}
      <section className="space-y-4">
        <h3 className="font-playfair text-xl sm:text-2xl font-medium text-foreground">
          Stream Everywhere
        </h3>
        <p className="text-xs text-muted-foreground">
          Listen to this release on your favorite streaming platform or on
          SoundKit.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* SoundKit Full App */}
          <a
            className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 p-4 hover:bg-primary/20 hover:border-primary/50 transition-all shadow-md group"
            href={soundKitTrackUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <div className="flex items-center gap-3">
              <Disc3 className="size-5 text-primary" />
              <div>
                <p className="font-bold text-sm text-foreground">SoundKit</p>
                <p className="text-[11px] text-muted-foreground">
                  Lossless Audio
                </p>
              </div>
            </div>
            <ExternalLink className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </a>

          {/* Spotify */}
          <a
            className="flex items-center justify-between rounded-2xl border border-border/50 bg-card/40 p-4 hover:border-[#1DB954]/50 hover:bg-[#1DB954]/10 transition-all shadow-md group"
            href={
              track.streamingLinks?.spotify &&
              isSafeExternalUrl(track.streamingLinks.spotify)
                ? track.streamingLinks.spotify
                : `https://open.spotify.com/search/${encodeURIComponent(`${track.title} ${track.artistName}`)}`
            }
            rel="noopener noreferrer"
            target="_blank"
          >
            <div className="flex items-center gap-3">
              <Headphones className="size-5 text-[#1DB954]" />
              <div>
                <p className="font-bold text-sm text-foreground">Spotify</p>
                <p className="text-[11px] text-muted-foreground">
                  Play on Spotify
                </p>
              </div>
            </div>
            <ExternalLink className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </a>

          {/* Apple Music */}
          <a
            className="flex items-center justify-between rounded-2xl border border-border/50 bg-card/40 p-4 hover:border-[#FC3C44]/50 hover:bg-[#FC3C44]/10 transition-all shadow-md group"
            href={
              track.streamingLinks?.appleMusic &&
              isSafeExternalUrl(track.streamingLinks.appleMusic)
                ? track.streamingLinks.appleMusic
                : `https://music.apple.com/us/search?term=${encodeURIComponent(`${track.title} ${track.artistName}`)}`
            }
            rel="noopener noreferrer"
            target="_blank"
          >
            <div className="flex items-center gap-3">
              <Music className="size-5 text-[#FC3C44]" />
              <div>
                <p className="font-bold text-sm text-foreground">Apple Music</p>
                <p className="text-[11px] text-muted-foreground">
                  Listen on Apple
                </p>
              </div>
            </div>
            <ExternalLink className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </a>

          {/* YouTube Music */}
          <a
            className="flex items-center justify-between rounded-2xl border border-border/50 bg-card/40 p-4 hover:border-[#FF0000]/50 hover:bg-[#FF0000]/10 transition-all shadow-md group"
            href={
              track.streamingLinks?.youtube &&
              isSafeExternalUrl(track.streamingLinks.youtube)
                ? track.streamingLinks.youtube
                : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${track.title} ${track.artistName}`)}`
            }
            rel="noopener noreferrer"
            target="_blank"
          >
            <div className="flex items-center gap-3">
              <Youtube className="size-5 text-[#FF0000]" />
              <div>
                <p className="font-bold text-sm text-foreground">YouTube</p>
                <p className="text-[11px] text-muted-foreground">
                  Watch & Listen
                </p>
              </div>
            </div>
            <ExternalLink className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </a>
        </div>
      </section>
    </div>
  );
}

function TrackNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground">
        <Music className="size-7" />
      </div>
      <div className="space-y-1">
        <h2 className="font-playfair text-2xl font-semibold text-foreground">
          Track Not Found
        </h2>
        <p className="text-xs text-muted-foreground">
          The requested track could not be loaded or is no longer available.
        </p>
      </div>
      <a
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
        href="/"
      >
        <span>Discover Artists & Music</span>
      </a>
    </div>
  );
}
