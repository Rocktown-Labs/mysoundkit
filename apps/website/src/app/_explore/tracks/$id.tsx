"use client";

/* eslint-disable no-use-before-define, react-perf/jsx-no-new-function-as-prop, react/no-unescaped-entities, react/no-array-index-key */
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  Play,
  Heart,
  Share2,
  Download,
  CheckCircle2,
  ShoppingCart,
  ArrowLeft,
  Plus,
  MessageCircle,
  MoreVertical,
  ShieldCheck,
  Zap,
  Info,
  Trophy,
  Library,
  FileAudio,
  FileJson,
  Layers,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { useCart } from "@/components/cart-provider";
import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AppleMusicIcon,
  SpotifyIcon,
  YoutubeMusicIcon,
} from "@/components/ui/brand-icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { API_V1_URL } from "@/lib/api";

// --- Types ---

type ArtistRole = "musician" | "producer";
type CatalogItemType = "single" | "album" | "ep" | "beat" | "instrumental";
type PurchaseMode = "digital_download" | "license";

interface MockArtist {
  id: string;
  name: string;
  handle: string;
  roles: ArtistRole[];
  verified?: boolean;
  avatarUrl: string;
  genre?: string;
  location?: string;
  followers?: string;
  listeners?: string;
  battleRank?: string;
  battleRecord?: string;
}

interface MockCatalogAsset {
  id: string;
  label: string;
  subtitle?: string;
  kind:
    | "master"
    | "clean"
    | "instrumental"
    | "alternate_mix"
    | "artwork"
    | "booklet"
    | "tagged_mp3"
    | "untagged_wav"
    | "stems"
    | "midi"
    | "license_pdf";
  format?: string;
  included: boolean;
  duration?: string;
}

interface MockLicenseOption {
  id: string;
  name: string;
  priceCents?: number;
  priceLabel: string;
  rightsSummary: string[];
  includesStems?: boolean;
  isExclusive?: boolean;
}

interface MockVisualContent {
  id: string;
  title: string;
  thumbnailUrl: string;
  type: "video" | "photo" | "artwork";
  views?: string;
}

interface MockCatalogItem {
  id: string;
  type: CatalogItemType;
  purchaseMode: PurchaseMode;
  title: string;
  artist: MockArtist;
  coverArtUrl: string;
  genre?: string;
  tags?: string[];
  bpm?: number;
  musicalKey?: string;
  duration?: string;
  streamCount?: string;
  streamingLinks?: {
    appleMusic?: string;
    spotify?: string;
    youtube?: string;
  };
  description?: string;
  priceCents?: number | null;
  priceLabel: string;
  isOwned?: boolean;
  isPurchasable: boolean;
  isStreamable: boolean;
  playbackUrl?: string | null;
  assets: MockCatalogAsset[];
  licenseOptions?: MockLicenseOption[];
  visualContent?: MockVisualContent[];
}

const formatDisplayPrice = (priceLabel: string) =>
  priceLabel.startsWith("$") ? priceLabel : `$${priceLabel}`;

const priceCentsFromLabel = (priceLabel: string) =>
  Math.round(Number(priceLabel.replace("$", "")) * 100);

const fetchCatalogItem = async (id: string): Promise<MockCatalogItem> => {
  const response = await fetch(`${API_V1_URL}/tracks/${id}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Track detail request failed with ${response.status}`);
  }

  const rawData = (await response.json()) as Record<string, unknown>;

  const artistObj = (
    rawData.artist && typeof rawData.artist === "object" ? rawData.artist : {}
  ) as Record<string, unknown>;

  const artistName =
    typeof artistObj.name === "string"
      ? artistObj.name
      : typeof rawData.artistName === "string"
        ? rawData.artistName
        : "SoundKit Artist";

  const artistHandle =
    typeof artistObj.handle === "string"
      ? artistObj.handle
      : typeof rawData.artistUsername === "string"
        ? rawData.artistUsername
        : "artist";

  const artistAvatarUrl =
    typeof artistObj.avatarUrl === "string"
      ? artistObj.avatarUrl
      : typeof rawData.coverArtUrl === "string"
        ? rawData.coverArtUrl
        : "/placeholder.svg";

  const normalizedArtist = {
    avatarUrl: artistAvatarUrl,
    followers:
      typeof artistObj.followers === "string" ? artistObj.followers : null,
    genre:
      typeof artistObj.genre === "string"
        ? artistObj.genre
        : typeof rawData.genre === "string"
          ? rawData.genre
          : "Uncategorized",
    handle: artistHandle,
    id:
      typeof artistObj.id === "string"
        ? artistObj.id
        : typeof rawData.ownerUserId === "string"
          ? rawData.ownerUserId
          : "artist",
    listeners:
      typeof artistObj.listeners === "string" ? artistObj.listeners : null,
    location:
      typeof artistObj.location === "string" ? artistObj.location : null,
    name: artistName,
    roles: Array.isArray(artistObj.roles)
      ? (artistObj.roles as ("musician" | "producer")[])
      : ["musician"],
    verified: Boolean(artistObj.verified ?? rawData.isVerified),
  };

  const rawPlaybackUrl =
    typeof rawData.playbackUrl === "string" && rawData.playbackUrl.length > 0
      ? rawData.playbackUrl
      : null;

  return {
    ...(rawData as unknown as MockCatalogItem),
    artist: normalizedArtist,
    coverArtUrl:
      typeof rawData.coverArtUrl === "string" && rawData.coverArtUrl.length > 0
        ? rawData.coverArtUrl
        : "/placeholder.svg",
    playbackUrl: rawPlaybackUrl,
    priceLabel:
      typeof rawData.priceLabel === "string"
        ? rawData.priceLabel
        : typeof rawData.price === "number"
          ? `$${rawData.price.toFixed(2)}`
          : "$1.99",
    title: typeof rawData.title === "string" ? rawData.title : "Untitled Track",
    type:
      (rawData.catalogItemType as CatalogItemType) ?? rawData.type ?? "track",
  };
};

export const Route = createFileRoute("/_explore/tracks/$id")({
  component: TrackPage,
});

function TrackPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { setCurrentTrack, setQueue, addToQueue } = useAudioPlayer();
  const { addItem } = useCart();
  const [isLiked, setIsLiked] = useState(false);

  const {
    data: item,
    error,
    isError,
    isLoading,
  } = useQuery({
    queryFn: () => fetchCatalogItem(id),
    queryKey: ["track-detail", id],
    retry: false,
  });
  const [selectedLicense, setSelectedLicense] =
    useState<MockLicenseOption | null>(null);

  useEffect(() => {
    setSelectedLicense(item?.licenseOptions?.[0] ?? null);
  }, [item?.licenseOptions]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-6 text-sm text-muted-foreground">
          Loading track...
        </div>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="font-bold text-2xl">Track unavailable</h1>
          <p className="text-muted-foreground text-sm">
            {error instanceof Error
              ? error.message
              : "This track could not be loaded from the API."}
          </p>
          <Button variant="outline" onClick={() => router.history.back()}>
            <ArrowLeft className="size-4" />
            Back to catalog
          </Button>
        </div>
      </div>
    );
  }

  const playerTrack = {
    artist: item.artist.name,
    artistHref: `/artist/${item.artist.handle}`,
    cover: item.coverArtUrl,
    id: item.id,
    src: item.playbackUrl ?? "",
    title: item.title,
    trackHref: `/tracks/${item.id}`,
  };

  const playCurrentTrack = () => {
    if (!item.playbackUrl) {
      toast({
        description: "No stream URL found for this track.",
        title: "Playback unavailable",
        variant: "destructive",
      });
      return;
    }

    setQueue([playerTrack]);
    setCurrentTrack(playerTrack);
    toast({
      description: `${item.title} by ${item.artist.name}`,
      title: "Now Playing",
    });
  };

  const handleQueueTrack = () => {
    if (addToQueue) {
      addToQueue(playerTrack);
    } else {
      setQueue((prev) => [...prev, playerTrack]);
    }
    toast({
      description: `Added "${item.title}" to play queue.`,
      title: "Queue Updated",
    });
  };

  const handleBuyTrack = () => {
    addItem({
      artistName: item.artist.name,
      coverArtUrl: item.coverArtUrl,
      priceCents: item.priceCents ?? 199,
      productType:
        item.type === "album" || item.type === "ep" ? "project" : "track",
      purchaseMode: "digital_download",
      title: item.title,
      trackId: item.id,
    });
    toast({
      description: `"${item.title}" (${item.priceLabel || "$1.99"}) added to cart.`,
      title: "Added to Cart",
    });
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast({
        description: "Track URL copied to clipboard.",
        title: "Link Copied",
      });
    }
  };

  const handleToggleLike = () => {
    setIsLiked((prev) => !prev);
    toast({
      description: isLiked
        ? `Removed "${item.title}" from your favorites.`
        : `Saved "${item.title}" to your favorites.`,
      title: isLiked ? "Removed from Favorites" : "Saved to Favorites",
    });
  };

  const handleDownloadAsset = (label: string) => {
    toast({
      description: `Preparing download package for ${label}...`,
      title: "Starting Download",
    });
  };

  useEffect(() => {
    setSelectedLicense(item.licenseOptions?.[0] || null);
  }, [item.id, item.licenseOptions]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Sharp Professional Header */}
      <div className="border-b border-border/10 bg-card/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.history.back()}
            className="text-muted-foreground hover:text-foreground font-black uppercase text-[10px] tracking-widest"
          >
            <ArrowLeft className="mr-2 size-3.5" />
            Catalog
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={handleShare}
              title="Share Track"
            >
              <Share2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={handleToggleLike}
              title="Favorite"
            >
              <Heart
                className={`size-4 ${isLiked ? "fill-rose-500 text-rose-500" : ""}`}
              />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Main Track Section */}
          <div className="space-y-8">
            {/* High-Impact Industrial Hero */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="size-60 md:size-72 shrink-0 relative group">
                <AppImage
                  src={item.coverArtUrl}
                  alt={item.title}
                  width={512}
                  height={512}
                  className="size-full object-cover rounded-lg shadow-2xl border border-border/40"
                />
                {item.isStreamable && (
                  <button
                    aria-label={`Play ${item.title}`}
                    className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-lg bg-black/40 opacity-0 transition-all hover:opacity-100"
                    disabled={!item.playbackUrl}
                    onClick={playCurrentTrack}
                    type="button"
                  >
                    <div className="size-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-2xl scale-90 group-hover:scale-100 transition-transform">
                      <Play className="size-8 fill-current" />
                    </div>
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-6 pt-2">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase font-black tracking-[0.2em] border-primary/40 text-primary bg-primary/5 px-2 py-0.5 h-5 rounded-none"
                    >
                      {item.type}
                    </Badge>
                    {item.artist.verified && (
                      <div className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                        <ShieldCheck className="size-3" /> SoundKit Verified
                      </div>
                    )}
                  </div>
                  <h1 className="text-4xl md:text-6xl font-black font-[family-name:var(--font-playfair)] tracking-tighter leading-[0.9] uppercase">
                    {item.title}
                  </h1>
                  <Link
                    to="/artist/$username"
                    params={{ username: item.artist.handle }}
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors group mt-4"
                  >
                    <span className="font-black text-lg uppercase tracking-tighter">
                      {item.artist.name}
                    </span>
                    <CheckCircle2 className="size-4 text-primary fill-primary/10" />
                  </Link>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  {item.isStreamable && (
                    <Button
                      size="lg"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-8 h-12 uppercase tracking-[0.1em] rounded-lg shadow-xl shadow-primary/20 flex-1 sm:flex-none"
                      disabled={!item.playbackUrl}
                      onClick={playCurrentTrack}
                    >
                      <Play className="size-5 mr-3 fill-current" /> Play
                    </Button>
                  )}
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-border/40 hover:bg-muted font-black px-8 h-12 uppercase tracking-[0.1em] rounded-lg flex-1 sm:flex-none"
                    disabled={!item.playbackUrl}
                    onClick={handleQueueTrack}
                  >
                    <Plus className="size-5 mr-2" /> Queue
                  </Button>
                  {item.isPurchasable && (
                    <Button
                      size="lg"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 h-12 uppercase tracking-[0.1em] rounded-lg flex-1 sm:flex-none"
                      onClick={handleBuyTrack}
                    >
                      <ShoppingCart className="size-5 mr-2" /> Buy{" "}
                      {item.priceLabel || "$1.99"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleToggleLike}
                    className={`size-12 rounded-lg border-border/40 hover:text-rose-500 hover:border-rose-500/40 ${isLiked ? "text-rose-500 border-rose-500/50 bg-rose-500/10" : ""}`}
                  >
                    <Heart
                      className={`size-6 ${isLiked ? "fill-current" : ""}`}
                    />
                  </Button>
                </div>

                <TrackPlatformLinks links={item.streamingLinks ?? {}} />

                {item.description ? (
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                ) : null}

                {/* Technical Metadata Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5 pt-5 border-t border-border/10">
                  {item.streamCount && (
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-black mb-1.5 opacity-50">
                        Streams
                      </p>
                      <p className="text-xl font-black tabular-nums">
                        {item.streamCount}
                      </p>
                    </div>
                  )}
                  {item.bpm && (
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-black mb-1.5 opacity-50">
                        BPM
                      </p>
                      <p className="text-xl font-black tabular-nums">
                        {item.bpm}
                      </p>
                    </div>
                  )}
                  {item.musicalKey && (
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-black mb-1.5 opacity-50">
                        Musical Key
                      </p>
                      <p className="text-xl font-black">{item.musicalKey}</p>
                    </div>
                  )}
                  {item.duration && (
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-black mb-1.5 opacity-50">
                        Runtime
                      </p>
                      <p className="text-xl font-black tabular-nums">
                        {item.duration}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Assets Section - Industrial List */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">
                  Included Files & Stems
                </h3>
                <Badge
                  variant="outline"
                  className="text-[8px] font-black border-border/60 uppercase tracking-widest rounded-none h-4"
                >
                  After Purchase
                </Badge>
              </div>
              <div className="bg-card/20 border border-border/40 rounded-none overflow-hidden divide-y divide-border/10 shadow-sm">
                {item.assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="group flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="size-10 bg-muted/40 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors border border-border/20">
                        <AssetIcon kind={asset.kind} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-sm uppercase tracking-tight">
                            {asset.label}
                          </p>
                          {!asset.included && (
                            <Badge
                              variant="secondary"
                              className="text-[8px] h-3.5 px-1 uppercase font-black bg-muted/50 text-muted-foreground"
                            >
                              Premium Only
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60 font-black">
                          {asset.subtitle || asset.kind.replace("_", " ")}{" "}
                          {asset.duration && `• ${asset.duration}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {asset.included ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={playCurrentTrack}
                            className="h-8 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity text-primary"
                          >
                            <Play className="size-3 mr-1.5 fill-current" />{" "}
                            Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDownloadAsset(asset.label)}
                            title={`Download ${asset.label}`}
                            className="size-9 rounded-none border-border/40 hover:bg-white/5 transition-all"
                          >
                            <Download className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 rounded-none opacity-20"
                        >
                          <Download className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Related Content & Releases Section */}
            <section className="space-y-4 pt-6 border-t border-border/20">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">
                  Related Tracks & Releases
                </h3>
                <Link
                  to="/tracks"
                  className="text-xs text-primary font-bold hover:underline"
                >
                  View Catalog →
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    cover: item.coverArtUrl,
                    genre: "Hip-Hop",
                    id: "rel-1",
                    price: "$1.99",
                    title: "Midnight Echoes",
                  },
                  {
                    cover: item.coverArtUrl,
                    genre: "Electronic",
                    id: "rel-2",
                    price: "$4.99",
                    title: "Synth Waves (Stems)",
                  },
                  {
                    cover: item.coverArtUrl,
                    genre: "R&B",
                    id: "rel-3",
                    price: "$9.99",
                    title: "Urban Rhythms Kit",
                  },
                  {
                    cover: item.coverArtUrl,
                    genre: "Soul",
                    id: "rel-4",
                    price: "$1.99",
                    title: "Velvet Nights",
                  },
                ].map((rel) => (
                  <Link
                    key={rel.id}
                    to="/tracks/$id"
                    params={{ id: rel.id }}
                    className="group border border-border/40 bg-card/20 rounded-xl p-3 hover:border-primary/50 transition-colors"
                  >
                    <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2 relative">
                      <AppImage
                        src={rel.cover}
                        alt={rel.title}
                        width={200}
                        height={200}
                        className="object-cover size-full group-hover:scale-105 transition-transform"
                      />
                      <Badge className="absolute top-2 right-2 bg-black/70 text-white text-[9px] font-bold">
                        {rel.price}
                      </Badge>
                    </div>
                    <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                      {rel.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{rel.genre}</p>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Dynamic Components ---

function TrackPlatformLinks({
  links,
}: {
  links: NonNullable<MockCatalogItem["streamingLinks"]>;
}) {
  const platformLinks = [
    links.spotify
      ? { href: links.spotify, icon: SpotifyIcon, label: "Spotify" }
      : null,
    links.appleMusic
      ? { href: links.appleMusic, icon: AppleMusicIcon, label: "Apple Music" }
      : null,
    links.youtube
      ? { href: links.youtube, icon: YoutubeMusicIcon, label: "YouTube" }
      : null,
  ].filter((link): link is Exclude<typeof link, null> => Boolean(link));

  if (platformLinks.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        Also on
      </span>
      {platformLinks.map((link) => {
        const Icon = link.icon;
        return (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            aria-label={link.label}
            className="flex size-9 items-center justify-center rounded-full border border-border/40 bg-muted/30 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          >
            <Icon className="size-4" />
          </a>
        );
      })}
    </div>
  );
}

function AssetIcon({ kind }: { kind: MockCatalogAsset["kind"] }) {
  switch (kind) {
    case "stems": {
      return <Layers className="size-5" />;
    }
    case "midi": {
      return <FileJson className="size-5" />;
    }
    case "license_pdf": {
      return <ShieldCheck className="size-5" />;
    }
    default: {
      return <FileAudio className="size-5" />;
    }
  }
}

interface CommerceCardProps {
  item: MockCatalogItem;
  selectedLicense: MockLicenseOption | null;
  onLicenseChange: (l: MockLicenseOption) => void;
}

function CommerceCard({
  item,
  selectedLicense,
  onLicenseChange,
}: CommerceCardProps) {
  const { addItem } = useCart();
  const itemPriceCents =
    item.priceCents ?? priceCentsFromLabel(item.priceLabel);

  const addDigitalPurchase = () =>
    addItem({
      artistName: item.artist.name,
      coverArtUrl: item.coverArtUrl,
      priceCents: itemPriceCents,
      productType:
        item.type === "album" || item.type === "ep" ? "project" : "track",
      projectId:
        item.type === "album" || item.type === "ep" ? item.id : undefined,
      purchaseMode: "digital_download",
      title: item.title,
      trackId:
        item.type === "album" || item.type === "ep" ? undefined : item.id,
    });

  const addLicensePurchase = () => {
    if (!selectedLicense) {
      return Promise.resolve();
    }

    return addItem({
      artistName: item.artist.name,
      coverArtUrl: item.coverArtUrl,
      licenseName: selectedLicense.name,
      licenseOptionId: selectedLicense.id,
      priceCents:
        selectedLicense.priceCents ??
        priceCentsFromLabel(selectedLicense.priceLabel),
      productType: "track",
      purchaseMode: "license",
      title: item.title,
      trackId: item.id,
    });
  };

  if (item.isOwned) {
    return (
      <Card className="bg-primary/10 border border-primary/30 shadow-2xl relative overflow-hidden flex flex-col rounded-none">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
        <CardHeader className="p-8">
          <div className="flex items-center justify-between mb-4">
            <Badge className="bg-primary text-primary-foreground uppercase text-[10px] font-black tracking-[0.2em] px-3 py-1 rounded-none">
              Library Active
            </Badge>
            <Library className="size-5 text-primary" />
          </div>
          <CardTitle className="text-3xl font-black uppercase tracking-tighter leading-none mb-2">
            Item Acquired
          </CardTitle>
          <CardDescription className="text-xs font-bold uppercase tracking-widest text-primary opacity-60">
            Full commercial access enabled
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8 pt-0 space-y-4">
          <Button
            size="lg"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 h-14 rounded-none"
          >
            <Download className="size-5 mr-3" /> Download All Files
          </Button>
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40 justify-center">
            <Info className="size-3" /> Digital purchase ID: #SK-
            {Math.floor(Math.random() * 999_999)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (item.purchaseMode === "license" && item.licenseOptions) {
    return (
      <Card className="bg-card/40 border border-border/40 shadow-2xl relative overflow-hidden flex flex-col rounded-none">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
        <CardHeader className="p-8">
          <div className="flex items-center justify-between mb-6">
            <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 uppercase text-[10px] font-black tracking-[0.2em] px-3 py-1 rounded-none">
              Licensing
            </Badge>
            <ShoppingCart className="size-5 text-blue-500" />
          </div>
          <div className="space-y-6">
            <Select
              value={selectedLicense?.id}
              onValueChange={(val) => {
                const opt = item.licenseOptions?.find((o) => o.id === val);
                if (opt) {
                  onLicenseChange(opt);
                }
              }}
            >
              <SelectTrigger className="w-full bg-background/50 h-14 font-black uppercase text-xs tracking-widest border-border/40 rounded-none ring-offset-background">
                <SelectValue placeholder="Select license tier" />
              </SelectTrigger>
              <SelectContent className="bg-card/95 backdrop-blur-xl border-border/40 rounded-none">
                {item.licenseOptions.map((opt) => (
                  <SelectItem
                    key={opt.id}
                    value={opt.id}
                    className="focus:bg-blue-500 focus:text-white py-3 rounded-none"
                  >
                    <div className="flex justify-between items-center w-full gap-12">
                      <span className="font-bold uppercase tracking-[0.1em]">
                        {opt.name}
                      </span>
                      <span className="font-black text-blue-500">
                        {formatDisplayPrice(opt.priceLabel)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedLicense && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-5xl font-black tracking-tighter mb-6 border-b border-border/10 pb-4">
                  {formatDisplayPrice(selectedLicense.priceLabel)}
                </div>
                <ul className="space-y-3.5">
                  {selectedLicense.rightsSummary.map((right, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-foreground/80"
                    >
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />{" "}
                      {right}
                    </li>
                  ))}
                  {selectedLicense.includesStems && (
                    <li className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-blue-500">
                      <Zap className="size-3.5 fill-current" /> Stems Included
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-8 mt-auto pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              variant="outline"
              className="w-full border-blue-500/40 text-blue-400 hover:bg-blue-500/10 font-bold uppercase tracking-wider text-xs h-14 rounded-lg"
              onClick={() => void addLicensePurchase()}
            >
              <ShoppingCart className="size-4 mr-2" /> Add to Cart
            </Button>
            <Button
              size="lg"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-wider text-xs shadow-xl shadow-blue-500/20 h-14 rounded-lg"
              onClick={async () => {
                await addLicensePurchase();
                toast({
                  description: "Proceeding to instant license checkout...",
                  title: "Buy Now",
                });
              }}
            >
              <Zap className="size-4 mr-2 fill-current" /> Buy Now
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Digital Download Release (Single/Album/EP)
  return (
    <Card className="bg-primary/5 border border-primary/20 shadow-2xl relative overflow-hidden flex flex-col rounded-xl">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
      <CardHeader className="p-8">
        <div className="flex items-center justify-between mb-6">
          <Badge className="bg-primary/10 text-primary border-primary/20 uppercase text-[10px] font-black tracking-[0.2em] px-3 py-1 rounded-md">
            Official Release
          </Badge>
          <ShoppingCart className="size-5 text-primary" />
        </div>
        <CardTitle className="text-5xl font-black tracking-tighter mb-2">
          {formatDisplayPrice(item.priceLabel)}
        </CardTitle>
        <CardDescription className="text-xs font-bold uppercase tracking-widest text-primary opacity-60">
          High-fidelity digital ownership
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 pb-8 pt-0 space-y-6">
        <ul className="space-y-4">
          <li className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-foreground/80">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" /> All
            tracks &amp; audio masters
          </li>
          <li className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-foreground/80">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />{" "}
            Uncompressed WAV &amp; 320kbps MP3
          </li>
        </ul>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            size="lg"
            variant="outline"
            className="w-full border-primary/30 text-primary hover:bg-primary/10 font-bold uppercase tracking-wider text-xs h-14 rounded-lg"
            onClick={() => void addDigitalPurchase()}
          >
            <ShoppingCart className="size-4 mr-2" /> Add to Cart
          </Button>
          <Button
            size="lg"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-wider text-xs shadow-xl shadow-primary/20 h-14 rounded-lg"
            onClick={async () => {
              await addDigitalPurchase();
              toast({
                description: "Proceeding to checkout...",
                title: "Buy Now",
              });
            }}
          >
            <Zap className="size-4 mr-2 fill-current" /> Buy Now
          </Button>
        </div>
        <p className="text-[8px] text-center text-muted-foreground uppercase font-black tracking-[0.3em] opacity-40">
          Verified secure transaction
        </p>
      </CardContent>
    </Card>
  );
}
