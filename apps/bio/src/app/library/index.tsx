/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Music,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  buildSoundKitWebUrl,
  getCurrentSessionUser,
  loadBioRecentTracks,
} from "@/lib/api";
import type { BioCurrentUser, BioRecentTrack } from "@/lib/api";

export const Route = createFileRoute("/library/")({
  component: BioFanLibraryPage,
});

const formatRelativeTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return "Recently";
  }

  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 60_000)
  );
  if (elapsedMinutes < 1) {
    return "Just now";
  }
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }
  return `${Math.floor(elapsedHours / 24)}d ago`;
};

function BioFanLibraryPage() {
  const [currentUser, setCurrentUser] = useState<BioCurrentUser | null>(null),
    [recentTracks, setRecentTracks] = useState<BioRecentTrack[]>([]),
    [isLoading, setIsLoading] = useState(true),
    [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadLibrary = async () => {
      try {
        const user = await getCurrentSessionUser();
        if (cancelled) {
          return;
        }
        setCurrentUser(user);
        if (user) {
          setRecentTracks(await loadBioRecentTracks());
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "We could not load your recent plays."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadLibrary();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6 text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 size-4 animate-spin text-primary" />
        Loading your listening history…
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Clock3 className="size-7" />
        </div>
        <h1 className="mt-5 font-playfair text-3xl font-medium text-foreground">
          Your listening history is private
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Sign in to see only the tracks you have listened to for at least 30
          seconds.
        </p>
        <a
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
          href={buildSoundKitWebUrl("/login")}
        >
          Sign in to continue
          <ArrowRight className="size-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <Clock3 className="size-4" />
            <span>Listening history</span>
          </div>
          <h1 className="mt-2 font-playfair text-3xl font-medium text-foreground sm:text-4xl">
            Recently Played
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your SoundKit plays that reached the 30-second listening threshold.
          </p>
        </div>

        <a
          className="inline-flex items-center gap-2 self-start rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-card sm:self-auto"
          href={buildSoundKitWebUrl("/library")}
          rel="noopener noreferrer"
          target="_blank"
        >
          Full SoundKit Library
          <ExternalLink className="size-3.5" />
        </a>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-border/50 bg-card/40 shadow-md">
        {recentTracks.length > 0 ? (
          <>
            <div className="hidden grid-cols-[minmax(14rem,2fr)_minmax(8rem,1fr)_minmax(7rem,0.7fr)_minmax(7rem,0.7fr)_5rem] gap-4 border-b border-border/50 px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
              <span>Song</span>
              <span>Artist</span>
              <span>Times played</span>
              <span>Last played</span>
              <span>Length</span>
            </div>
            <div className="divide-y divide-border/40">
              {recentTracks.map((track) => (
                <RecentTrackRow key={track.id} track={track} />
              ))}
            </div>
          </>
        ) : (
          <div className="p-10 text-center sm:p-16">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground">
              <Music className="size-6" />
            </div>
            <h2 className="mt-4 font-playfair text-2xl font-medium text-foreground">
              Nothing here yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Start listening and this list will fill with your own 30-second
              plays.
            </p>
            <Link
              className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
              to="/"
            >
              Explore artists
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function RecentTrackRow({ track }: { track: BioRecentTrack }) {
  return (
    <div className="grid gap-3 px-4 py-4 transition-colors hover:bg-white/[0.03] md:grid-cols-[minmax(14rem,2fr)_minmax(8rem,1fr)_minmax(7rem,0.7fr)_minmax(7rem,0.7fr)_5rem] md:items-center md:gap-4 md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-black/40">
          {track.coverArtUrl ? (
            <img
              alt={track.title}
              className="size-full object-cover"
              src={track.coverArtUrl}
            />
          ) : (
            <Music className="size-4 text-muted-foreground" />
          )}
        </div>
        <Link
          className="min-w-0 truncate text-sm font-semibold text-foreground transition-colors hover:text-primary"
          params={{ id: track.id }}
          to="/tracks/$id"
        >
          {track.title}
        </Link>
      </div>
      <span className="truncate pl-14 text-xs text-muted-foreground md:pl-0">
        {track.artistName}
      </span>
      <span className="pl-14 text-xs font-mono text-muted-foreground md:pl-0">
        {track.timesPlayed.toLocaleString()}
      </span>
      <span className="pl-14 text-xs text-muted-foreground md:pl-0">
        {formatRelativeTime(track.lastPlayedAt)}
      </span>
      <span className="pl-14 text-xs font-mono text-muted-foreground md:pl-0">
        {track.duration}
      </span>
    </div>
  );
}
