/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo, unicorn/no-negated-condition, eslint/no-negated-condition, react/preserve-manual-memoization */
"use client";

import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  ChevronRight,
  ExternalLink,
  HandCoins,
  Headphones,
  Instagram,
  Layers,
  Link2,
  LoaderCircle,
  MapPin,
  Music,
  Pause,
  Play,
  Radio,
  Share2,
  UserCheck,
  UserPlus,
  Video,
  X,
  Twitter,
  Youtube,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { useBioAudioPlayer } from "@/components/bio-audio-player";
import {
  API_V1_URL,
  buildSoundKitWebUrl,
  SOUNDKIT_BIO_URL,
  SOUNDKIT_WEB_URL,
  STRIPE_PUBLISHABLE_KEY,
  isSafeExternalUrl,
  loadBioProfile,
  toAbsoluteBioUrl,
  toBioShareUrl,
} from "@/lib/api";
import type {
  BioArtist,
  BioProfile,
  BioProject,
  BioTrack,
  BioVideo,
} from "@/lib/api";

const getSoundKitWebOrigin = () => {
  try {
    return new URL(SOUNDKIT_WEB_URL).origin;
  } catch {
    return "https://mysoundkit.com";
  }
};
const SOUNDKIT_WEB_ORIGIN = getSoundKitWebOrigin();
const stripePromise = STRIPE_PUBLISHABLE_KEY
  ? loadStripe(STRIPE_PUBLISHABLE_KEY)
  : null;
const presetAmounts = [500, 1000, 2500, 5000] as const;
const formatDollars = (amountCents: number) =>
  `$${(amountCents / 100).toFixed(2)}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

const formatCount = (value: number | undefined) => {
  if (!value) {
    return "0";
  }
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
};

const formatPossessive = (name: string) => {
  const trimmed = name.trim();
  if (trimmed.endsWith("s") || trimmed.endsWith("S") || trimmed.endsWith("'")) {
    return `${trimmed}'`;
  }
  return `${trimmed}'s`;
};

export const Route = createFileRoute("/$username")({
  component: BioProfilePage,
  head: ({ loaderData, params }) => {
    const profile = loaderData as unknown as BioProfile | null;
    const name = profile?.artist.name ?? `@${params.username}`;
    const title = `Check out ${formatPossessive(name)} SoundKit bio`;
    const description =
      profile?.artist.bio ||
      `Stream releases, listen to tracks, and support ${name} on SoundKit.`;
    const image = toAbsoluteBioUrl(
      profile?.artist.coverImageUrl ||
        profile?.artist.avatarUrl ||
        "/soundkit-social-card.png"
    );
    const canonical = `${SOUNDKIT_BIO_URL}/${encodeURIComponent(params.username)}`;

    return {
      links: [{ href: canonical, rel: "canonical" }],
      meta: [
        { title },
        { content: description, name: "description" },
        { content: canonical, property: "og:url" },
        { content: "profile", property: "og:type" },
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
  loader: async ({ params }) => await loadBioProfile(params.username),
});

type TabType = "feed" | "tracks" | "projects" | "videos" | "credits" | "live";

function BioProfilePage() {
  const { username } = Route.useParams(),
    profile = Route.useLoaderData() as BioProfile | null;
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isTipOpen, setIsTipOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("feed");
  const authPopupRef = useRef<Window | null>(null);

  const { currentTrack, isPlaying, playTrack, togglePlay } =
    useBioAudioPlayer();

  const beginAuthHandoff = (_action: "tip" | "follow" = "tip") => {
    const returnOrigin = window.location.origin;
    const loginUrl = `${SOUNDKIT_WEB_URL}/auth/handoff?returnOrigin=${encodeURIComponent(returnOrigin)}`;
    const popup = window.open(
      loginUrl,
      "soundkit-auth-handoff",
      "popup,width=480,height=760,resizable,scrollbars"
    );

    if (!popup) {
      setAuthMessage("Allow pop-ups to sign in securely with SoundKit.");
      return;
    }

    authPopupRef.current = popup;
    setAuthMessage("Sign in via the SoundKit window to continue.");
  };

  const handleTipClick = () => {
    if (authToken) {
      setIsTipOpen(true);
      return;
    }
    beginAuthHandoff("tip");
  };

  const handleFollowClick = () => {
    if (!authToken) {
      beginAuthHandoff("follow");
      return;
    }
    setIsFollowing((prev) => !prev);
  };

  const handleShareClick = async () => {
    if (typeof window === "undefined") {
      return;
    }
    const shareUrl = toBioShareUrl(username);
    const artistName = artist?.name || "this artist";
    const shareTitle = `Check out ${formatPossessive(artistName)} SoundKit bio`;
    if (navigator.share) {
      try {
        await navigator.share({
          text: `Check out ${formatPossessive(artistName)} SoundKit bio — stream tracks and support releases on SoundKit.`,
          title: shareTitle,
          url: shareUrl,
        });
      } catch {
        // Dismissed share sheet
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== SOUNDKIT_WEB_ORIGIN ||
        event.source !== authPopupRef.current ||
        !isRecord(event.data)
      ) {
        return;
      }

      if (
        event.data.type !== "soundkit-auth-handoff" ||
        typeof event.data.token !== "string"
      ) {
        return;
      }

      setAuthToken(event.data.token);
      setAuthMessage("Signed in successfully with SoundKit.");
      setIsTipOpen(true);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const artist = profile?.artist;
  const media = profile?.media;
  const tracks = useMemo(() => {
    if (!media) {
      return [];
    }
    return media.tracks.length > 0 ? media.tracks : media.featuredTracks;
  }, [media]);

  // Available tabs calculation: Feed is always active; others only appear if data exists
  const availableTabs = useMemo(() => {
    const tabs: { id: TabType; label: string; count?: number }[] = [
      { id: "feed", label: "Feed" },
    ];
    if (!media) {
      return tabs;
    }
    if (tracks.length > 0) {
      tabs.push({ count: tracks.length, id: "tracks", label: "Tracks" });
    }
    if (media.projects.length > 0) {
      tabs.push({
        count: media.projects.length,
        id: "projects",
        label: "Projects",
      });
    }
    if (media.videos.length > 0) {
      tabs.push({ count: media.videos.length, id: "videos", label: "Videos" });
    }
    if (media.credits.length > 0) {
      tabs.push({
        count: media.credits.length,
        id: "credits",
        label: "Credits",
      });
    }
    if (profile?.live && profile.live.status === "live") {
      tabs.push({ id: "live", label: "Live" });
    }
    return tabs;
  }, [media, tracks, profile?.live]);

  if (!profile || !artist || !media) {
    return <ProfileNotFound />;
  }

  const soundKitArtistUrl = buildSoundKitWebUrl(
    `/artist/${encodeURIComponent(artist.username)}`,
    artist.username
  );

  return (
    <div className="mx-auto min-w-0 w-full max-w-5xl overflow-x-clip px-4 py-4 sm:px-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Cover Banner */}
      {artist.coverImageUrl ? (
        <div className="relative h-24 w-full overflow-hidden rounded-3xl border border-border/40 shadow-md sm:h-48 md:h-56">
          <img
            alt="Cover"
            className="size-full object-cover"
            src={artist.coverImageUrl}
          />
        </div>
      ) : (
        <div className="relative h-16 w-full overflow-hidden rounded-3xl border border-border/30 bg-card/40 sm:h-32" />
      )}

      {/* Condensed Profile Card */}
      <div className="relative z-10 -mt-8 overflow-hidden rounded-3xl border border-border/40 bg-card/60 p-5 text-center shadow-xl backdrop-blur-xl sm:-mt-20 sm:p-7 sm:text-left md:p-8">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
          {/* Circular Avatar */}
          <div className="relative shrink-0">
            <div className="size-20 sm:size-28 md:size-32 overflow-hidden rounded-full border-4 border-card bg-muted/60 shadow-lg">
              {artist.avatarUrl ? (
                <img
                  alt={artist.name}
                  className="size-full object-cover"
                  src={artist.avatarUrl}
                />
              ) : (
                <div className="flex size-full items-center justify-center font-bold text-2xl sm:text-4xl text-primary font-playfair">
                  {artist.name[0]?.toUpperCase()}
                </div>
              )}
            </div>
            {artist.verified ? (
              <div
                aria-label="Verified artist"
                className="absolute bottom-0 right-0 flex size-6 sm:size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
                title="Verified SoundKit Artist"
              >
                <Check className="size-3.5 sm:size-4 stroke-[3]" />
              </div>
            ) : null}
          </div>

          {/* Profile Header Details */}
          <div className="min-w-0 w-full flex-1 space-y-2">
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0">
                <h1 className="font-playfair text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground">
                  {artist.name}
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5 sm:justify-start">
                  <span className="text-primary font-bold text-xs sm:text-sm">
                    @{artist.username}
                  </span>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    {artist.genre || "Independent Artist"}
                  </span>
                  {artist.location ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {artist.location}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 pt-1 sm:justify-end sm:pt-0">
                <button
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold shadow transition-all ${
                    isFollowing
                      ? "border border-primary bg-primary/15 text-primary"
                      : "bg-primary text-primary-foreground hover:opacity-90 active:scale-95"
                  }`}
                  onClick={handleFollowClick}
                  type="button"
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="size-3.5" />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-3.5" />
                      <span>Follow</span>
                    </>
                  )}
                </button>

                <button
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white/5 px-4 py-1.5 text-xs sm:text-sm font-semibold text-foreground hover:bg-white/10 hover:border-primary/40 transition-all active:scale-95"
                  onClick={handleTipClick}
                  type="button"
                >
                  <HandCoins className="size-3.5 text-primary" />
                  <span>Tip</span>
                </button>

                <button
                  aria-label="Share bio"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white/5 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                  onClick={handleShareClick}
                  type="button"
                >
                  {copiedLink ? (
                    <>
                      <Check className="size-3.5 text-primary" />
                      <span className="text-primary font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="size-3.5" />
                      <span className="hidden sm:inline">Share</span>
                    </>
                  )}
                </button>

                <a
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                  href={soundKitArtistUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span>Full Profile</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-xs text-muted-foreground sm:justify-start sm:gap-5">
              <div>
                <span className="font-bold text-foreground">
                  {tracks.length}
                </span>{" "}
                Tracks
              </div>
              <div className="h-2.5 w-px bg-border" />
              <div>
                <span className="font-bold text-foreground">
                  {formatCount(artist.followers)}
                </span>{" "}
                Followers
              </div>
              <div className="h-2.5 w-px bg-border" />
              <div>
                <span className="font-bold text-foreground">Record: 0-0</span>{" "}
                Battles
              </div>
            </div>

            {/* Bio */}
            {artist.bio ? (
              <p className="mx-auto max-w-2xl text-xs leading-relaxed text-muted-foreground/90 whitespace-pre-wrap pt-1 sm:mx-0 sm:text-sm">
                {artist.bio}
              </p>
            ) : null}

            {authMessage ? (
              <p aria-live="polite" className="text-xs text-primary pt-1">
                {authMessage}
              </p>
            ) : null}

            {/* Social & Streaming Links Row */}
            {artist.links && Object.keys(artist.links).length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border/40 pt-2 sm:justify-start">
                {artist.links.spotify &&
                isSafeExternalUrl(artist.links.spotify) ? (
                  <a
                    aria-label="Spotify"
                    className="flex size-7 sm:size-8 items-center justify-center rounded-full border border-border/50 bg-white/5 text-muted-foreground hover:bg-[#1DB954]/20 hover:text-[#1DB954] hover:border-[#1DB954]/40 transition-all"
                    href={artist.links.spotify}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Headphones className="size-3.5 sm:size-4" />
                  </a>
                ) : null}

                {artist.links.appleMusic &&
                isSafeExternalUrl(artist.links.appleMusic) ? (
                  <a
                    aria-label="Apple Music"
                    className="flex size-7 sm:size-8 items-center justify-center rounded-full border border-border/50 bg-white/5 text-muted-foreground hover:bg-[#FC3C44]/20 hover:text-[#FC3C44] hover:border-[#FC3C44]/40 transition-all"
                    href={artist.links.appleMusic}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Music className="size-3.5 sm:size-4" />
                  </a>
                ) : null}

                {artist.links.youtube &&
                isSafeExternalUrl(artist.links.youtube) ? (
                  <a
                    aria-label="YouTube"
                    className="flex size-7 sm:size-8 items-center justify-center rounded-full border border-border/50 bg-white/5 text-muted-foreground hover:bg-[#FF0000]/20 hover:text-[#FF0000] hover:border-[#FF0000]/40 transition-all"
                    href={artist.links.youtube}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Youtube className="size-3.5 sm:size-4" />
                  </a>
                ) : null}

                {artist.links.instagram &&
                isSafeExternalUrl(artist.links.instagram) ? (
                  <a
                    aria-label="Instagram"
                    className="flex size-7 sm:size-8 items-center justify-center rounded-full border border-border/50 bg-white/5 text-muted-foreground hover:bg-[#E4405F]/20 hover:text-[#E4405F] hover:border-[#E4405F]/40 transition-all"
                    href={artist.links.instagram}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Instagram className="size-3.5 sm:size-4" />
                  </a>
                ) : null}

                {artist.links.twitter &&
                isSafeExternalUrl(artist.links.twitter) ? (
                  <a
                    aria-label="Twitter / X"
                    className="flex size-7 sm:size-8 items-center justify-center rounded-full border border-border/50 bg-white/5 text-muted-foreground hover:bg-white/20 hover:text-foreground hover:border-white/40 transition-all"
                    href={artist.links.twitter}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Twitter className="size-3.5 sm:size-4" />
                  </a>
                ) : null}

                {artist.links.personalSite &&
                isSafeExternalUrl(artist.links.personalSite) ? (
                  <a
                    aria-label="Website"
                    className="flex size-7 sm:size-8 items-center justify-center rounded-full border border-border/50 bg-white/5 text-muted-foreground hover:bg-primary/20 hover:text-primary hover:border-primary/40 transition-all"
                    href={artist.links.personalSite}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Link2 className="size-3.5 sm:size-4" />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Dynamic Tabs Navigation */}
      <div className="flex items-center justify-start border-b border-border/50 pb-px overflow-x-auto gap-2">
        {availableTabs.map((tab) => (
          <button
            className={`relative flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.id === "live" ? (
              <span className="flex size-2 rounded-full bg-red-500 animate-ping" />
            ) : null}
            <span>{tab.label}</span>
            {typeof tab.count === "number" ? (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-mono text-muted-foreground">
                {tab.count}
              </span>
            ) : null}
            {activeTab === tab.id ? (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            ) : null}
          </button>
        ))}
      </div>

      {/* Tab Content Panes */}
      <div className="pt-2">
        {/* Feed Tab: Mirrored web layout (Top 6 tracks, projects preview, videos preview, featured on) */}
        {activeTab === "feed" && (
          <div className="space-y-10">
            {/* Tracks Preview */}
            {tracks.length > 0 ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-playfair text-xl sm:text-2xl font-medium text-foreground">
                    Tracks
                  </h3>
                  {tracks.length > 6 ? (
                    <button
                      className="text-xs font-semibold text-primary hover:underline"
                      onClick={() => setActiveTab("tracks")}
                      type="button"
                    >
                      View all ({tracks.length})
                    </button>
                  ) : null}
                </div>

                <div
                  className="flex flex-wrap justify-center gap-3 md:justify-start md:gap-4"
                  data-testid="artist-track-grid"
                >
                  {tracks.slice(0, 6).map((track) => (
                    <BioTrackCard
                      currentTrackId={currentTrack?.id}
                      isPlaying={isPlaying}
                      key={track.id}
                      onPlay={() => {
                        if (currentTrack?.id === track.id) {
                          togglePlay();
                        } else {
                          playTrack(track, tracks);
                        }
                      }}
                      track={track}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Projects Preview */}
            {media.projects.length > 0 ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-playfair text-xl sm:text-2xl font-medium text-foreground">
                    Projects
                  </h3>
                  {media.projects.length > 4 ? (
                    <button
                      className="text-xs font-semibold text-primary hover:underline"
                      onClick={() => setActiveTab("projects")}
                      type="button"
                    >
                      View all ({media.projects.length})
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap justify-center gap-3 md:justify-start md:gap-4">
                  {media.projects.slice(0, 4).map((project) => (
                    <BioProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Videos Preview */}
            {media.videos.length > 0 ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-playfair text-xl sm:text-2xl font-medium text-foreground">
                    Videos
                  </h3>
                  {media.videos.length > 2 ? (
                    <button
                      className="text-xs font-semibold text-primary hover:underline"
                      onClick={() => setActiveTab("videos")}
                      type="button"
                    >
                      View all ({media.videos.length})
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap justify-start gap-4">
                  {media.videos.slice(0, 2).map((video) => (
                    <BioVideoCard key={video.id} video={video} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Also Featured On */}
            {media.featuredTracks.length > 0 && media.tracks.length > 0 ? (
              <section className="space-y-4">
                <h3 className="font-playfair text-xl sm:text-2xl font-medium text-foreground">
                  Also Featured On
                </h3>
                <div className="flex flex-wrap justify-center gap-3 md:justify-start md:gap-4">
                  {media.featuredTracks.slice(0, 6).map((track) => (
                    <BioTrackCard
                      currentTrackId={currentTrack?.id}
                      isPlaying={isPlaying}
                      key={track.id}
                      onPlay={() => {
                        if (currentTrack?.id === track.id) {
                          togglePlay();
                        } else {
                          playTrack(track, media.featuredTracks);
                        }
                      }}
                      track={track}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}

        {/* Tracks Tab: Full catalog */}
        {activeTab === "tracks" && (
          <div className="space-y-6">
            <h3 className="font-playfair text-2xl font-medium text-foreground">
              All Tracks ({tracks.length})
            </h3>
            <div
              className="flex flex-wrap justify-center gap-3 md:justify-start md:gap-4"
              data-testid="artist-track-grid"
            >
              {tracks.map((track) => (
                <BioTrackCard
                  currentTrackId={currentTrack?.id}
                  isPlaying={isPlaying}
                  key={track.id}
                  onPlay={() => {
                    if (currentTrack?.id === track.id) {
                      togglePlay();
                    } else {
                      playTrack(track, tracks);
                    }
                  }}
                  track={track}
                />
              ))}
            </div>
          </div>
        )}

        {/* Projects Tab */}
        {activeTab === "projects" && (
          <div className="space-y-6">
            <h3 className="font-playfair text-2xl font-medium text-foreground">
              Projects ({media.projects.length})
            </h3>
            <div className="flex flex-wrap justify-center gap-3 md:justify-start md:gap-4">
              {media.projects.map((project) => (
                <BioProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        )}

        {/* Videos Tab */}
        {activeTab === "videos" && (
          <div className="space-y-6">
            <h3 className="font-playfair text-2xl font-medium text-foreground">
              Videos ({media.videos.length})
            </h3>
            <div className="flex flex-wrap justify-start gap-4">
              {media.videos.map((video) => (
                <BioVideoCard key={video.id} video={video} />
              ))}
            </div>
          </div>
        )}

        {/* Credits Tab */}
        {activeTab === "credits" && (
          <div className="space-y-6">
            <h3 className="font-playfair text-2xl font-medium text-foreground">
              Production & Songwriting Credits ({media.credits.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {media.credits.map((credit) => (
                <div
                  className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/40 p-3 backdrop-blur"
                  key={credit.id}
                >
                  <div className="size-12 rounded-xl bg-black/40 overflow-hidden shrink-0 border border-border/40">
                    {credit.coverArtUrl ? (
                      <img
                        alt={credit.title}
                        className="size-full object-cover"
                        src={credit.coverArtUrl}
                      />
                    ) : (
                      <Music className="size-5 m-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-sm text-foreground">
                      {credit.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {credit.ownerName}
                    </p>
                    <span className="inline-block mt-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                      {credit.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Tab */}
        {activeTab === "live" && profile.live && (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-8 text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/20 px-3 py-1 text-xs font-bold text-red-400">
              <Radio className="size-4 animate-pulse" />
              <span>Currently Live</span>
            </div>
            <h3 className="font-playfair text-3xl font-medium text-foreground">
              {profile.live.title}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {artist.name} is streaming live right now on SoundKit.
            </p>
            <Link
              className="inline-flex items-center gap-2 rounded-full bg-red-500 px-6 py-3 font-bold text-sm text-white shadow-lg shadow-red-500/25 hover:bg-red-600 transition-all"
              params={{ id: profile.live.id }}
              to="/live/$id"
            >
              <span>Watch Live Stream</span>
              <Radio className="size-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Tip Dialog Component */}
      <TipCheckoutDialog
        artist={artist}
        authToken={authToken}
        onOpenChange={setIsTipOpen}
        onReauthenticate={() => beginAuthHandoff("tip")}
        open={isTipOpen}
      />
    </div>
  );
}

function BioTrackCard({
  currentTrackId,
  isPlaying,
  onPlay,
  track,
}: {
  currentTrackId?: string;
  isPlaying: boolean;
  onPlay: () => void;
  track: BioTrack;
}) {
  const isThisPlaying = isPlaying && currentTrackId === track.id;

  return (
    <article
      className="group relative flex w-[calc((100%-1.5rem)/3)] sm:w-[calc((100%-1.5rem)/3)] md:w-[180px] lg:w-[200px] flex-col min-w-0 cursor-pointer"
      data-testid="track-card"
    >
      {/* Frameless Artwork with play button overlay */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted/60 border border-border/30">
        {track.coverArtUrl ? (
          <img
            alt={track.title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            src={track.coverArtUrl}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Music className="size-8 text-muted-foreground/50" />
          </div>
        )}

        <button
          aria-label={isThisPlaying ? "Pause track" : `Play ${track.title}`}
          className={`absolute bottom-2.5 right-2.5 flex size-9 sm:size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-all ${
            isThisPlaying
              ? "opacity-100 scale-100 ring-2 ring-white/50"
              : "opacity-90 sm:opacity-0 sm:group-hover:opacity-100 scale-90 sm:group-hover:scale-100"
          } hover:scale-110 active:scale-95`}
          onClick={onPlay}
          type="button"
        >
          {isThisPlaying ? (
            <Pause className="size-4 sm:size-5 fill-current" />
          ) : (
            <Play className="ml-0.5 size-4 sm:size-5 fill-current" />
          )}
        </button>
      </div>

      {/* Info */}
      <div className="mt-2 min-w-0 flex-1 space-y-0.5">
        <Link
          className="block truncate font-semibold text-xs sm:text-sm text-foreground hover:text-primary transition-colors"
          params={{ id: track.id }}
          title={track.title}
          to="/tracks/$id"
        >
          {track.title}
        </Link>
        <p className="truncate text-[11px] text-muted-foreground">
          {track.artistName}
        </p>

        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground/80 font-mono">
          <span>{track.duration || "0:00"}</span>
          <span>{track.plays ? track.plays.toLocaleString() : "0"} plays</span>
        </div>
      </div>
    </article>
  );
}

function BioProjectCard({ project }: { project: BioProject }) {
  return (
    <Link
      className="group w-[calc((100%-0.75rem)/2)] max-w-[260px] md:w-[calc((100%-1.5rem)/3)] lg:w-[calc((100%-2.25rem)/4)] flex flex-col min-w-0"
      params={{ id: project.id }}
      to="/projects/$id"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted/60 border border-border/30">
        {project.coverArtUrl ? (
          <img
            alt={project.title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            src={project.coverArtUrl}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Layers className="size-8 text-muted-foreground/50" />
          </div>
        )}
        <span className="absolute top-2 left-2 rounded-full border border-black/40 bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase text-white backdrop-blur">
          {project.projectType}
        </span>
      </div>
      <div className="mt-2 min-w-0 space-y-0.5">
        <p className="truncate font-semibold text-xs sm:text-sm text-foreground hover:text-primary transition-colors">
          {project.title}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {project.trackCount} {project.trackCount === 1 ? "track" : "tracks"}
        </p>
      </div>
    </Link>
  );
}

function BioVideoCard({ video }: { video: BioVideo }) {
  return (
    <Link
      className="group w-full md:w-[calc((100%-1rem)/2)] flex flex-col min-w-0"
      params={{ id: video.id }}
      to="/videos/$id"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted/60 border border-border/30">
        {video.thumbnailUrl ? (
          <img
            alt={video.title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            src={video.thumbnailUrl}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Video className="size-8 text-muted-foreground/50" />
          </div>
        )}
        {video.duration ? (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-mono text-white backdrop-blur">
            {video.duration}
          </span>
        ) : null}
      </div>
      <div className="mt-2 min-w-0 space-y-0.5">
        <p className="truncate font-semibold text-xs sm:text-sm text-foreground hover:text-primary transition-colors">
          {video.title}
        </p>
        {video.viewCount ? (
          <p className="text-[11px] text-muted-foreground">
            {video.viewCount} views
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function TipCheckoutDialog({
  artist,
  authToken,
  onOpenChange,
  onReauthenticate,
  open,
}: {
  artist: BioArtist;
  authToken: string | null;
  onOpenChange: (open: boolean) => void;
  onReauthenticate: () => void;
  open: boolean;
}) {
  const [amountCents, setAmountCents] = useState(1000);
  const [customAmount, setCustomAmount] = useState("10.00");
  const [message, setMessage] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkoutOptions = clientSecret ? { clientSecret } : null;

  const close = () => {
    setClientSecret(null);
    setErrorMessage(null);
    onOpenChange(false);
  };

  const selectPreset = (preset: number) => {
    setAmountCents(preset);
    setCustomAmount((preset / 100).toFixed(2));
    setErrorMessage(null);
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const parsed = Number(value);
    setAmountCents(Number.isFinite(parsed) ? Math.round(parsed * 100) : 0);
    setErrorMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(authToken && amountCents >= 100 && amountCents <= 100_000)) {
      setErrorMessage("Choose an amount between $1.00 and $1,000.00.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_V1_URL}/payments/tips`, {
        body: JSON.stringify({
          amountCents,
          artistUserId: artist.id,
          cancelUrl: window.location.href,
          idempotencyKey: crypto.randomUUID(),
          message: message.trim() || undefined,
          successUrl: `${window.location.href}#tip-complete`,
        }),
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload: unknown = await response.json().catch(() => null);

      if (response.status === 401) {
        setErrorMessage("Your sign-in expired. Sign in again to continue.");
        return;
      }
      if (!response.ok) {
        const apiMessage =
          isRecord(payload) && typeof payload.message === "string"
            ? payload.message
            : "Unable to start secure checkout.";
        throw new Error(apiMessage);
      }

      const nextClientSecret =
        isRecord(payload) && typeof payload.clientSecret === "string"
          ? payload.clientSecret
          : null;
      if (nextClientSecret) {
        setClientSecret(nextClientSecret);
        return;
      }

      setErrorMessage(
        isRecord(payload) && payload.setupRequired === true
          ? "Tip checkout is temporarily unavailable."
          : "Stripe checkout could not be started."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start secure checkout."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <dialog
      aria-labelledby="tip-dialog-title"
      className="fixed inset-0 z-50 m-0 flex h-full w-full max-w-none items-end justify-center border-0 bg-black/80 p-4 backdrop-blur-md sm:items-center"
      open
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border/60 bg-card p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              Direct Support
            </span>
            <h2
              className="mt-2 font-playfair text-2xl sm:text-3xl font-medium text-foreground"
              id="tip-dialog-title"
            >
              Tip {artist.name}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Your tip goes directly to the artist via SoundKit&apos;s secure
              Stripe checkout.
            </p>
          </div>
          <button
            aria-label="Close tip dialog"
            className="rounded-full p-2 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            onClick={close}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        {clientSecret && stripePromise && checkoutOptions ? (
          <div className="mt-6 min-h-[520px] overflow-hidden rounded-2xl bg-white p-2">
            <EmbeddedCheckoutProvider
              options={checkoutOptions}
              stripe={stripePromise}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <fieldset>
              <legend className="font-semibold text-xs sm:text-sm text-foreground">
                Choose an amount
              </legend>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {presetAmounts.map((preset) => (
                  <button
                    className={`rounded-2xl border px-3 py-2.5 font-semibold text-xs sm:text-sm transition-all ${
                      amountCents === preset
                        ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                        : "border-border/60 bg-white/5 text-foreground/80 hover:bg-white/10"
                    }`}
                    key={preset}
                    onClick={() => selectPreset(preset)}
                    type="button"
                  >
                    {formatDollars(preset)}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label
                className="block font-semibold text-xs text-muted-foreground"
                htmlFor="custom-amount-input"
              >
                Custom amount (USD)
              </label>
              <div className="relative mt-2">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                  $
                </span>
                <input
                  className="h-10 w-full rounded-2xl border border-border/60 bg-white/5 pl-7 pr-4 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  id="custom-amount-input"
                  inputMode="decimal"
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  placeholder="10.00"
                  type="text"
                  value={customAmount}
                />
              </div>
            </div>

            <div>
              <label
                className="block font-semibold text-xs text-muted-foreground"
                htmlFor="tip-message-input"
              >
                Message for {artist.name} (optional)
              </label>
              <textarea
                className="mt-2 min-h-20 w-full rounded-2xl border border-border/60 bg-white/5 p-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                id="tip-message-input"
                maxLength={280}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Keep inspiring us with your sound..."
                value={message}
              />
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {errorMessage}
              </div>
            ) : null}

            {authToken ? null : (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground flex items-center justify-between">
                <span>Sign in with SoundKit to continue.</span>
                <button
                  className="font-bold text-primary hover:underline ml-2"
                  onClick={onReauthenticate}
                  type="button"
                >
                  Sign in
                </button>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                className="rounded-full px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                onClick={close}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90 disabled:opacity-50 transition-all"
                disabled={isSubmitting || amountCents < 100}
                type="submit"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    <span>Preparing...</span>
                  </>
                ) : (
                  <>
                    <span>Tip {formatDollars(amountCents)}</span>
                    <ChevronRight className="size-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}

function ProfileNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground">
        <Music className="size-7" />
      </div>
      <div className="space-y-1">
        <h2 className="font-playfair text-2xl font-semibold text-foreground">
          Artist Profile Not Found
        </h2>
        <p className="text-xs text-muted-foreground">
          This artist profile doesn&apos;t exist on SoundKit yet, or the
          username is incorrect.
        </p>
      </div>
      <Link
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
        to="/"
      >
        <span>Discover Artists on SoundKit.bio</span>
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
