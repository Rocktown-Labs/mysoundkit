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
import { useEffect, useMemo, useState } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { useCart } from "@/components/cart-provider";
import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

// --- Mock Data ---

const MOCK_ARTISTS: Record<string, MockArtist> = {
  dual: {
    avatarUrl: "/diverse-user-avatars.png",
    followers: "12K",
    genre: "Electronic / Pop",
    handle: "arivera",
    id: "a3",
    listeners: "85K",
    location: "Brooklyn, NY",
    name: "Alex Rivera",
    roles: ["musician", "producer"],
    verified: false,
  },
  luna: {
    avatarUrl: "/diverse-user-avatars.png",
    followers: "124K",
    genre: "R&B / Soul",
    handle: "luna-eclipse",
    id: "a1",
    listeners: "1.2M",
    location: "Los Angeles, CA",
    name: "Luna Eclipse",
    roles: ["musician"],
    verified: true,
  },
  metro: {
    avatarUrl: "/diverse-user-avatars.png",
    battleRank: "#1",
    battleRecord: "120-2",
    followers: "8.4M",
    genre: "Hip-Hop / Trap",
    handle: "metroboomin",
    id: "a2",
    listeners: "45M",
    location: "Atlanta, GA",
    name: "Metro Boomin",
    roles: ["producer"],
    verified: true,
  },
};

const MOCK_CATALOG: MockCatalogItem[] = [
  {
    artist: MOCK_ARTISTS.luna,
    assets: [
      {
        duration: "3:24",
        id: "as1",
        included: true,
        kind: "master",
        label: "High Quality Master",
        subtitle: "24-bit WAV",
      },
      {
        duration: "3:24",
        id: "as2",
        included: true,
        kind: "clean",
        label: "Radio Edit",
        subtitle: "Clean Version",
      },
      {
        id: "as3",
        included: true,
        kind: "booklet",
        label: "Digital Booklet",
        subtitle: "PDF Artwork",
      },
    ],
    coverArtUrl: "/summer-music-album-cover.png",
    description:
      "A smooth R&B track perfect for late-night drives. Inspired by the coastal vibes of California.",
    duration: "3:24",
    genre: "R&B / Soul",
    id: "single-1",
    isPurchasable: true,
    isStreamable: true,
    playbackUrl: "/demo-audio/fantasy26.wav",
    priceCents: 129,
    priceLabel: "1.29",
    purchaseMode: "digital_download",
    streamCount: "2,420,150",
    title: "Summer Nights",
    type: "single",
    visualContent: [
      {
        id: "v1",
        thumbnailUrl: "/music-battle-live-performance-video.jpg",
        title: "Official Music Video",
        type: "video",
        views: "1.2M",
      },
    ],
  },
  {
    artist: MOCK_ARTISTS.metro,
    assets: [
      {
        duration: "2:45",
        id: "as4",
        included: true,
        kind: "tagged_mp3",
        label: "Tagged Preview",
      },
      {
        duration: "2:45",
        id: "as5",
        included: true,
        kind: "untagged_wav",
        label: "Untagged WAV",
      },
      {
        id: "as6",
        included: true,
        kind: "stems",
        label: "Track Stems",
        subtitle: "12 Individual tracks",
      },
      {
        id: "as7",
        included: true,
        kind: "midi",
        label: "MIDI Files",
        subtitle: "Melody & Bass",
      },
    ],
    bpm: 142,
    coverArtUrl: "/hip-hop-album-cover.png",
    description:
      "Hard hitting trap beat with aggressive 808s and cinematic textures.",
    duration: "2:45",
    genre: "Hip-Hop / Trap",
    id: "beat-1",
    isPurchasable: true,
    isStreamable: true,
    playbackUrl: "/demo-audio/long-way-26.wav",
    licenseOptions: [
      {
        id: "l1",
        name: "Basic Lease",
        priceCents: 2999,
        priceLabel: "29.99",
        rightsSummary: ["5,000 Streams", "MP3 + WAV", "Non-Exclusive"],
      },
      {
        id: "l2",
        name: "Premium Lease",
        priceCents: 7999,
        priceLabel: "79.99",
        rightsSummary: [
          "Unlimited Streams",
          "Includes Stems",
          "Commercial Use",
        ],
      },
      {
        id: "l3",
        isExclusive: true,
        name: "Exclusive",
        priceCents: 49_999,
        priceLabel: "499.99",
        rightsSummary: ["Full Ownership", "Removed from Store", "Contract PDF"],
      },
    ],
    musicalKey: "Dm",
    priceCents: 2999,
    priceLabel: "29.99",
    purchaseMode: "license",
    streamCount: "500,420",
    title: "Dark Knights",
    type: "beat",
  },
  {
    artist: MOCK_ARTISTS.dual,
    assets: [
      {
        id: "as8",
        included: true,
        kind: "master",
        label: "Complete Album",
        subtitle: "9 Tracks (FLAC)",
      },
      { id: "as9", included: true, kind: "artwork", label: "Digital Artwork" },
    ],
    coverArtUrl: "/night-music-album-cover.png",
    description:
      "The debut studio album exploring neon-noir soundscapes and digital isolation.",
    genre: "Electronic / Pop",
    id: "owned-1",
    isOwned: true,
    isPurchasable: false,
    isStreamable: true,
    playbackUrl: "/demo-audio/dumbledore.wav",
    priceCents: 1499,
    priceLabel: "14.99",
    purchaseMode: "digital_download",
    streamCount: "8,245,100",
    title: "Midnight Chronicles",
    type: "album",
  },
];

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

  const data = (await response.json()) as MockCatalogItem & {
    catalogItemType?: CatalogItemType;
  };

  return {
    ...data,
    type: data.catalogItemType ?? data.type,
  };
};

export const Route = createFileRoute("/_explore/tracks/$id")({
  component: TrackPage,
});

function TrackPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { setCurrentTrack, setQueue } = useAudioPlayer();

  const fallbackItem = useMemo(
    () => MOCK_CATALOG.find((entry) => entry.id === id) || MOCK_CATALOG[0],
    [id]
  );
  const { data } = useQuery({
    queryFn: () => fetchCatalogItem(id),
    queryKey: ["track-detail", id],
    retry: false,
  });
  const item = data ?? fallbackItem;
  const playerTrack = {
    artist: item.artist.name,
    artistHref: `/artist/${item.artist.handle}`,
    cover: item.coverArtUrl,
    id: item.id,
    src: item.playbackUrl ?? "",
    title: item.title,
    trackHref: `/tracks/${item.id}`,
  };

  const [selectedLicense, setSelectedLicense] = useState(
    item.licenseOptions?.[0] || null
  );
  const playCurrentTrack = () => {
    if (!item.playbackUrl) {
      return;
    }

    setQueue([playerTrack]);
    setCurrentTrack(playerTrack);
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
            <Button variant="ghost" size="icon" className="size-8">
              <Share2 className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreVertical className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16">
        <div className="grid lg:grid-cols-12 gap-16">
          {/* Main Track Section */}
          <div className="lg:col-span-8 space-y-12">
            {/* High-Impact Industrial Hero */}
            <div className="flex flex-col md:flex-row gap-10 items-start">
              <div className="size-64 md:size-80 shrink-0 relative group">
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

              <div className="flex-1 space-y-8 pt-2">
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
                  <h1 className="text-5xl md:text-7xl font-black font-[family-name:var(--font-playfair)] tracking-tighter leading-[0.85] uppercase">
                    {item.title}
                  </h1>
                  <Link
                    to="/artist/$username"
                    params={{ username: item.artist.handle }}
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors group mt-4"
                  >
                    <span className="font-black text-xl uppercase tracking-tighter">
                      {item.artist.name}
                    </span>
                    <CheckCircle2 className="size-4 text-primary fill-primary/10" />
                  </Link>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  {item.isStreamable && (
                    <Button
                      size="lg"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-10 h-14 uppercase tracking-[0.1em] rounded-none shadow-xl shadow-primary/20 flex-1 sm:flex-none"
                      disabled={!item.playbackUrl}
                      onClick={playCurrentTrack}
                    >
                      <Play className="size-5 mr-3 fill-current" /> Play Preview
                    </Button>
                  )}
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-border/40 hover:bg-muted font-black px-8 h-14 uppercase tracking-[0.1em] rounded-none flex-1 sm:flex-none"
                    disabled={!item.playbackUrl}
                    onClick={playCurrentTrack}
                  >
                    <Plus className="size-5 mr-2" /> Queue
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-14 rounded-none border-border/40 hover:text-rose-500 hover:border-rose-500/40"
                  >
                    <Heart className="size-6" />
                  </Button>
                </div>

                {/* Technical Metadata Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-8 border-t border-border/10">
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
                  Package Contents
                </h3>
                <Badge
                  variant="outline"
                  className="text-[8px] font-black border-border/60 uppercase tracking-widest rounded-none h-4"
                >
                  Hi-Res Audio
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
                            className="h-8 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity text-primary"
                          >
                            <Play className="size-3 mr-1.5 fill-current" />{" "}
                            Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
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

            {/* Visual Content - Grid */}
            {item.visualContent && item.visualContent.length > 0 && (
              <section className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60 px-2">
                  Visual Production
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {item.visualContent.map((visual) => (
                    <div
                      key={visual.id}
                      className="group block space-y-3 cursor-pointer"
                    >
                      <div className="aspect-video rounded-none overflow-hidden border border-border/40 relative bg-muted/20">
                        <AppImage
                          src={visual.thumbnailUrl}
                          alt={visual.title}
                          width={400}
                          height={225}
                          className="size-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="size-12 text-white fill-current shadow-2xl" />
                        </div>
                        {visual.views && (
                          <div className="absolute bottom-3 right-3 bg-black px-2 py-1 text-[9px] font-black text-white uppercase tracking-widest border border-white/10">
                            {visual.views} Views
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between px-1">
                        <p className="font-black text-xs uppercase tracking-[0.1em] group-hover:text-primary transition-colors">
                          {visual.title}
                        </p>
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                          {visual.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Sidebar - Commercial Core */}
          <div className="lg:col-span-4 space-y-8">
            <CommerceCard
              item={item}
              selectedLicense={selectedLicense}
              onLicenseChange={setSelectedLicense}
            />

            {/* Artist Sidebar Card */}
            <Card className="bg-card/20 border-border/40 rounded-none overflow-hidden">
              <CardContent className="p-8 space-y-8">
                <Link
                  to="/artist/$username"
                  params={{ username: item.artist.handle }}
                  className="flex flex-col items-center group"
                >
                  <div className="relative mb-6">
                    <div className="absolute -inset-2 bg-primary rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition duration-1000" />
                    <Avatar className="size-28 border border-border/40 rounded-full relative overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-500">
                      <AvatarImage
                        src={item.artist.avatarUrl}
                        className="object-cover"
                      />
                      <AvatarFallback>AT</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="text-center space-y-2">
                    <h4 className="text-2xl font-black group-hover:text-primary transition-colors font-[family-name:var(--font-playfair)] tracking-tighter uppercase leading-none">
                      {item.artist.name}
                    </h4>
                    <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                      {item.artist.roles.map((r) => (
                        <Badge
                          key={r}
                          variant="secondary"
                          className="text-[8px] uppercase tracking-[0.2em] h-4 bg-muted font-black px-1.5 rounded-none"
                        >
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Link>

                <div className="grid grid-cols-2 gap-4 text-center border-y border-border/10 py-6">
                  <div>
                    <p className="text-xl font-black tabular-nums">
                      {item.artist.followers}
                    </p>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-black opacity-60">
                      Followers
                    </p>
                  </div>
                  <div>
                    <p className="text-xl font-black tabular-nums">
                      {item.artist.listeners}
                    </p>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-black opacity-60">
                      Listeners
                    </p>
                  </div>
                </div>

                {item.artist.battleRank && (
                  <div className="bg-white/[0.03] border border-border/40 rounded-none p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="size-10 bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
                        <Trophy className="size-5" />
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-black opacity-60">
                          Global Rank
                        </p>
                        <p className="text-base font-black">
                          {item.artist.battleRank}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-black opacity-60">
                        Record
                      </p>
                      <p className="text-base font-black text-emerald-500">
                        {item.artist.battleRecord}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Button className="w-full h-12 font-black uppercase text-xs tracking-[0.2em] rounded-none shadow-xl shadow-primary/10">
                    Follow Artist
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-12 font-black uppercase text-xs tracking-[0.2em] border-border/40 hover:bg-white/5 rounded-none"
                  >
                    <MessageCircle className="size-4 mr-2" /> Message
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Tips */}
            <div className="px-2 space-y-4">
              <div className="flex items-start gap-4 p-4 bg-muted/20 border-l-2 border-primary">
                <Zap className="size-5 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-muted-foreground font-medium italic">
                  "Every digital purchase directly supports the artist and gives
                  you lifetime access to high-fidelity audio masters."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Dynamic Components ---

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
        <CardContent className="p-8 mt-auto pt-0">
          <Button
            size="lg"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 h-16 rounded-none"
            onClick={() => void addLicensePurchase()}
          >
            Purchase License
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Digital Download Release (Single/Album/EP)
  return (
    <Card className="bg-primary/5 border border-primary/20 shadow-2xl relative overflow-hidden flex flex-col rounded-none">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
      <CardHeader className="p-8">
        <div className="flex items-center justify-between mb-6">
          <Badge className="bg-primary/10 text-primary border-primary/20 uppercase text-[10px] font-black tracking-[0.2em] px-3 py-1 rounded-none">
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
      <CardContent className="px-8 pb-8 pt-0 space-y-8">
        <ul className="space-y-4">
          <li className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-foreground/80">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" /> All
            tracks & audio masters
          </li>
          <li className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-foreground/80">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />{" "}
            High-resolution artwork
          </li>
          <li className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-foreground/80">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />{" "}
            Lifetime library access
          </li>
        </ul>
        <Button
          size="lg"
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 h-16 rounded-none"
          onClick={() => void addDigitalPurchase()}
        >
          Buy {item.type.toUpperCase()}
        </Button>
        <p className="text-[8px] text-center text-muted-foreground uppercase font-black tracking-[0.3em] opacity-40">
          Verified secure transaction
        </p>
      </CardContent>
    </Card>
  );
}
