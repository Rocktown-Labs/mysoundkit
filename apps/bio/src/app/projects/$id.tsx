/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Disc3,
  ExternalLink,
  Layers,
  Music,
  Pause,
  Play,
  Share2,
} from "lucide-react";
import React, { useState } from "react";

import { useBioAudioPlayer } from "@/components/bio-audio-player";
import {
  buildSoundKitWebUrl,
  loadBioProject,
  SOUNDKIT_BIO_URL,
  toAbsoluteBioUrl,
} from "@/lib/api";
import type { BioProjectDetail, BioTrack } from "@/lib/api";

export const Route = createFileRoute("/projects/$id")({
  component: BioProjectDetailPage,
  head: ({ loaderData, params }) => {
    const project = loaderData as unknown as BioProjectDetail | null,
      title = project
        ? `${project.title} by ${project.artistName} — SoundKit.bio`
        : "Project Details — SoundKit.bio",
      description =
        project?.description ||
        (project
          ? `Stream ${project.title} by ${project.artistName} on SoundKit.`
          : "Discover projects and albums on SoundKit.bio."),
      image = toAbsoluteBioUrl(
        project?.coverArtUrl || "/soundkit-social-card.png"
      ),
      canonical = `${SOUNDKIT_BIO_URL}/projects/${encodeURIComponent(params.id)}`;

    return {
      links: [{ href: canonical, rel: "canonical" }],
      meta: [
        { title },
        { content: description, name: "description" },
        { content: canonical, property: "og:url" },
        { content: "music.album", property: "og:type" },
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
  loader: async ({ params }) => await loadBioProject(params.id),
});

function BioProjectDetailPage() {
  const project = Route.useLoaderData() as BioProjectDetail | null,
    [copiedLink, setCopiedLink] = useState(false),
    { currentTrack, isPlaying, playProjectTracks, playTrack, togglePlay } =
      useBioAudioPlayer();

  if (!project) {
    return <ProjectNotFound />;
  }

  const isProjectPlaying =
      isPlaying &&
      project.tracks.some((track) => track.id === currentTrack?.id),
    handlePlayProject = () => {
      if (isProjectPlaying) {
        togglePlay();
      } else if (project.tracks.length > 0) {
        playProjectTracks(project.tracks);
      }
    },
    handlePlayTrack = (track: BioTrack) => {
      if (currentTrack?.id === track.id) {
        togglePlay();
      } else {
        playTrack(track, project.tracks);
      }
    },
    handleShareClick = () => {
      if (typeof window !== "undefined") {
        navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2200);
      }
    },
    soundKitProjectUrl = buildSoundKitWebUrl(
      `/projects/${encodeURIComponent(project.id)}`,
      project.artistUsername ?? undefined
    );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10 space-y-8">
      {/* Back to Artist link */}
      <div>
        {project.artistUsername ? (
          <Link
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
            params={{ username: project.artistUsername }}
            to="/$username"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to @{project.artistUsername}</span>
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

      {/* Project Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/60 p-6 sm:p-10 backdrop-blur-2xl shadow-2xl">
        {/* Glow backdrop */}
        {project.coverArtUrl ? (
          <div className="pointer-events-none absolute inset-0 opacity-20 blur-3xl">
            <img
              alt=""
              className="size-full object-cover"
              src={project.coverArtUrl}
            />
          </div>
        ) : (
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-96 rounded-full bg-primary/15 blur-3xl" />
        )}

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
          {/* Artwork */}
          <div className="relative group shrink-0">
            <div className="size-56 sm:size-64 md:size-72 overflow-hidden rounded-2xl border border-border/60 bg-black/40 shadow-2xl">
              {project.coverArtUrl ? (
                <img
                  alt={project.title}
                  className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                  src={project.coverArtUrl}
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Layers className="size-16 text-muted-foreground/40" />
                </div>
              )}
            </div>

            {/* Play Button Overlay */}
            {project.tracks.length > 0 ? (
              <button
                aria-label={
                  isProjectPlaying ? "Pause project" : "Play entire project"
                }
                className={`absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-all ${
                  isProjectPlaying
                    ? "opacity-100 scale-100 ring-4 ring-white/30"
                    : "opacity-90 sm:opacity-0 sm:group-hover:opacity-100 scale-95 sm:group-hover:scale-100"
                } hover:scale-110 active:scale-95`}
                onClick={handlePlayProject}
                type="button"
              >
                {isProjectPlaying ? (
                  <Pause className="size-8 fill-current" />
                ) : (
                  <Play className="ml-1 size-8 fill-current" />
                )}
              </button>
            ) : null}
          </div>

          {/* Details & Actions */}
          <div className="min-w-0 flex-1 text-center md:text-left space-y-5">
            <div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  {project.projectType}
                </span>
                {project.releaseDate ? (
                  <span className="text-xs text-muted-foreground">
                    Released {project.releaseDate}
                  </span>
                ) : null}
              </div>

              <h1 className="mt-3 font-playfair text-3xl sm:text-5xl font-medium tracking-tight text-foreground">
                {project.title}
              </h1>

              <div className="mt-2">
                {project.artistUsername ? (
                  <Link
                    className="font-semibold text-base sm:text-lg text-primary hover:underline"
                    params={{ username: project.artistUsername }}
                    to="/$username"
                  >
                    {project.artistName}
                  </Link>
                ) : (
                  <span className="font-semibold text-base sm:text-lg text-primary">
                    {project.artistName}
                  </span>
                )}
              </div>

              {project.description ? (
                <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
                  {project.description}
                </p>
              ) : null}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
              {project.tracks.length > 0 ? (
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90 hover:scale-105 active:scale-95 transition-all"
                  onClick={handlePlayProject}
                  type="button"
                >
                  {isProjectPlaying ? (
                    <>
                      <Pause className="size-4 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="size-4 fill-current" />
                      <span>Play Project ({project.tracks.length})</span>
                    </>
                  )}
                </button>
              ) : null}

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
                    <Share2 className="size-4 text-muted-foreground" />
                    <span>Share</span>
                  </>
                )}
              </button>

              <a
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white/5 px-4 py-3 text-xs sm:text-sm font-semibold text-foreground/80 hover:bg-white/10 hover:text-foreground transition-all"
                href={soundKitProjectUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span>SoundKit</span>
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Tracklist Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="size-4 text-primary" />
            <h2 className="font-semibold text-base sm:text-lg text-foreground">
              Tracklist ({project.tracks.length})
            </h2>
          </div>
        </div>

        {project.tracks.length > 0 ? (
          <div className="overflow-hidden rounded-3xl border border-border/50 bg-card/40 backdrop-blur-xl shadow-md divide-y divide-border/30">
            {project.tracks.map((track, idx) => {
              const isThisPlaying = isPlaying && currentTrack?.id === track.id;
              return (
                <div
                  className={`flex items-center justify-between gap-3 p-3 sm:p-4 transition-colors ${
                    isThisPlaying ? "bg-primary/10" : "hover:bg-white/5"
                  }`}
                  key={track.id}
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <span className="w-6 text-center font-mono text-xs text-muted-foreground">
                      {idx + 1}
                    </span>

                    <button
                      aria-label={
                        isThisPlaying ? "Pause track" : `Play ${track.title}`
                      }
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => handlePlayTrack(track)}
                      type="button"
                    >
                      {isThisPlaying ? (
                        <Pause className="size-4 fill-current" />
                      ) : (
                        <Play className="ml-0.5 size-4 fill-current" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <Link
                        className={`block truncate font-medium text-xs sm:text-sm hover:text-primary transition-colors ${
                          isThisPlaying
                            ? "text-primary font-bold"
                            : "text-foreground"
                        }`}
                        params={{ id: track.id }}
                        to="/tracks/$id"
                      >
                        {track.title}
                      </Link>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {track.artistName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    {track.plays ? (
                      <span className="hidden sm:inline text-xs text-muted-foreground/70 font-mono">
                        {track.plays.toLocaleString()} plays
                      </span>
                    ) : null}
                    <span className="font-mono text-xs text-muted-foreground">
                      {track.duration || "0:00"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border/60 bg-card/20 p-10 text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              No tracks published for this project yet.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function ProjectNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground">
        <Disc3 className="size-7" />
      </div>
      <div className="space-y-1">
        <h2 className="font-playfair text-2xl font-semibold text-foreground">
          Project Not Found
        </h2>
        <p className="text-xs text-muted-foreground">
          The requested project could not be found or is no longer available.
        </p>
      </div>
      <Link
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
        to="/"
      >
        <span>Discover Artists & Projects</span>
      </Link>
    </div>
  );
}
