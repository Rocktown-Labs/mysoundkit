/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ExternalLink, Music } from "lucide-react";
import React from "react";

import { useBioAudioPlayer } from "@/components/bio-audio-player";
import { buildSoundKitWebUrl } from "@/lib/api";

export const Route = createFileRoute("/library/")({
  component: BioFanLibraryPage,
});

function BioFanLibraryPage() {
  const { queue } = useBioAudioPlayer(),
    fullWebLibraryUrl = buildSoundKitWebUrl("/library");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            Listener Hub
          </span>
          <h1 className="mt-2 font-playfair text-3xl sm:text-4xl font-medium text-foreground">
            My SoundKit Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Access your recent plays, followed creators, and saved releases.
          </p>
        </div>

        <a
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs font-semibold text-foreground hover:bg-card hover:border-primary/40 transition-all shadow-sm"
          href={fullWebLibraryUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <span>Full SoundKit Library</span>
          <ExternalLink className="size-3.5" />
        </a>
      </div>

      {/* Recent Plays from Audio Player Queue */}
      <div className="rounded-3xl border border-border/50 bg-card/40 p-6 sm:p-8 backdrop-blur-xl shadow-md space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="size-5 text-primary" />
            <h2 className="font-semibold text-lg text-foreground">
              Recently Streamed Tracks
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {queue.length} in session
          </span>
        </div>

        {queue.length > 0 ? (
          <div className="divide-y divide-border/40">
            {queue.map((track) => (
              <div
                className="flex items-center justify-between py-3 hover:bg-white/5 px-2 rounded-xl transition-colors"
                key={track.id}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-xl bg-black/40 overflow-hidden shrink-0 border border-border/40">
                    {track.coverArtUrl ? (
                      <img
                        alt={track.title}
                        className="size-full object-cover"
                        src={track.coverArtUrl}
                      />
                    ) : (
                      <Music className="size-4 m-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <a
                      className="font-medium text-sm text-foreground hover:text-primary transition-colors block truncate"
                      href={`/tracks/${encodeURIComponent(track.id)}`}
                    >
                      {track.title}
                    </a>
                    <p className="text-xs text-muted-foreground truncate">
                      {track.artistName}
                    </p>
                  </div>
                </div>

                <span className="text-xs font-mono text-muted-foreground shrink-0 ml-2">
                  {track.duration || "0:00"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/50 p-8 text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              You haven&apos;t played any tracks in this session yet.
            </p>
            <a
              className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
              href="/"
            >
              <span>Explore music by region</span>
              <ArrowRight className="size-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Sync with SoundKit Callout */}
      <div className="rounded-3xl border border-border/50 bg-gradient-to-r from-card to-card/60 p-6 sm:p-8 backdrop-blur-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 max-w-lg">
          <h3 className="font-semibold text-base text-foreground">
            Want to sync your liked songs and playlists?
          </h3>
          <p className="text-xs text-muted-foreground">
            Open SoundKit Web to browse curated playlists, vote in beat battles,
            and chat with other listeners.
          </p>
        </div>

        <a
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 hover:opacity-90 transition-all shrink-0"
          href={fullWebLibraryUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <span>Open Web Library</span>
          <ArrowRight className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
