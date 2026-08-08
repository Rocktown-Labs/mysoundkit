"use client";

import { useRouter,createFileRoute,Link } from "@tanstack/react-router";
import {
  Play,
  Heart,
  Share2,
  Download,
  Clock,
  Headphones,
  Music,
  CheckCircle2,
  ShoppingCart,
  ArrowLeft,
  Plus,
  ListMusic,
  Volume2,
  Film,
  ExternalLink,
  MessageCircle,
  MoreVertical,
  SkipForward,
  LayoutGrid,
  ShieldCheck,
  Disc,
  Info,
} from "lucide-react";
import { useState } from "react";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { absoluteSiteUrl, createShareMeta } from "@/lib/seo";
import { shareLink } from "@/lib/share";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_explore/projects/$id")({
  component: ProjectPage,
  head: ({ params }) =>
    createShareMeta({
      canonicalPath: `/projects/${params.id}`,
      description:
        "Play Coastal Echoes EP by Luna Eclipse on SoundKit, featuring streamable tracks and downloadable project files.",
      imageUrl: "/hip-hop-album-cover.png",
      title: "Play Coastal Echoes EP on SoundKit",
      type: "music.album",
    }),
});

function ProjectPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { setCurrentTrack, setQueue } = useAudioPlayer();
  const { addItem } = useCart();
  const [isLiked, setIsLiked] = useState(false);

  // Mock data
  const project = {
    artist: "Luna Eclipse",
    artistSlug: "luna-eclipse",
    associatedVideos: [
      {
        id: "vid1",
        thumbnail: "/music-battle-live-performance-video.jpg",
        title: "Official Visualizer",
        views: "2.1M",
      },
    ],
    cover: "/hip-hop-album-cover.png",
    description:
      "A collection of late-night vibes and summer anthems. 'Coastal Echoes' explores the boundaries of experimental soul and modern R&B production. Featuring collaborations with top-tier LA producers and engineers.",
    genre: "R&B / Soul",
    id,
    likes: "142,800",
    plays: "12,420,000",
    price: "49.99",
    releaseDate: "Jan 15, 2025",
    title: "Coastal Echoes EP",
    tracks: [
      {
        duration: "3:24",
        explicit: true,
        id: "t1",
        playbackUrl: "/demo-audio/long-way-26.wav",
        plays: "2.4M",
        title: "Summer Nights",
      },
      {
        duration: "4:12",
        explicit: false,
        id: "t2",
        playbackUrl: "/demo-audio/dumbledore.wav",
        plays: "1.8M",
        title: "Ocean Breeze",
      },
      {
        duration: "3:45",
        explicit: true,
        id: "t3",
        playbackUrl: "/demo-audio/long-way-26.wav",
        plays: "3.2M",
        title: "Midnight Drive",
      },
      {
        duration: "3:58",
        explicit: false,
        id: "t4",
        plays: "5.0M",
        title: "Sunset Waves",
      },
    ],
    verified: true,
  };

  const playAlbum = () => {
    const queueTracks = project.tracks
      .filter((t) => Boolean(t.playbackUrl))
      .map((t) => ({
        artist: project.artist,
        artistHref: `/artist/${project.artistSlug}`,
        cover: project.cover,
        id: t.id,
        src: t.playbackUrl!,
        title: t.title,
        trackHref: `/tracks/${t.id}`,
      }));
    if (queueTracks.length > 0) {
      setQueue(queueTracks);
      setCurrentTrack(queueTracks[0]);
      toast({
        description: `Started playing "${project.title}".`,
        title: "Playing Album",
      });
    }
  };

  const playSingleTrack = (t: (typeof project.tracks)[number]) => {
    if (!t.playbackUrl) {return;}
    const playerTrack = {
      artist: project.artist,
      artistHref: `/artist/${project.artistSlug}`,
      cover: project.cover,
      id: t.id,
      src: t.playbackUrl,
      title: t.title,
      trackHref: `/tracks/${t.id}`,
    };
    setQueue([playerTrack]);
    setCurrentTrack(playerTrack);
    toast({
      description: `Now playing "${t.title}".`,
      title: "Playing Track",
    });
  };

  const toggleLike = () => {
    setIsLiked((prev) => !prev);
    toast({
      description: isLiked
        ? `Removed "${project.title}" from library.`
        : `Added "${project.title}" to library.`,
      title: isLiked ? "Unliked" : "Liked",
    });
  };

  const buyAlbum = () => {
    const priceCents = Math.round(Number.parseFloat(project.price) * 100);
    addItem({
      artistName: project.artist,
      coverArtUrl: project.cover,
      priceCents,
      productType: "project",
      projectId: project.id,
      purchaseMode: "digital_download",
      title: project.title,
    });
    toast({
      description: `"${project.title}" added to cart.`,
      title: "Added to Cart",
    });
  };

  const handleShare = async () => {
    const shareUrl = absoluteSiteUrl(`/projects/${project.id}`);
    const outcome = await shareLink({
      text: `Play ${project.title} by ${project.artist} on SoundKit.`,
      title: `Play ${project.title} on SoundKit`,
      url: shareUrl,
    });

    if (outcome === "shared") {
      return;
    }

    if (outcome === "unsupported") {
      toast({
        description: "Sharing is not supported on this device.",
        title: "Unable to share",
        variant: "destructive",
      });
      return;
    }

    toast({
      description: `Project URL copied to clipboard: ${shareUrl}`,
      title: "Link Copied",
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Professional Header */}
      <div className="border-b border-border/10 bg-card/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.history.back()}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-2 size-4" />
            Collection
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => void handleShare()}
              title="Share Project"
            >
              <Share2 className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-9">
              <MoreVertical className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="grid lg:grid-cols-12 gap-12">
          {/* Main Content Column */}
          <div className="lg:col-span-8 space-y-12">
            {/* Project Hero */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="size-64 md:size-80 shrink-0 relative group shadow-2xl">
                <AppImage
                  src={project.cover}
                  alt={project.title}
                  width={512}
                  height={512}
                  className="size-full object-cover rounded-xl border border-border/40"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                  <Play className="size-16 text-white fill-current" />
                </div>
              </div>

              <div className="flex-1 space-y-6 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-2 py-0.5 text-[9px] uppercase font-black tracking-[0.2em]">
                      Album Release
                    </Badge>
                    <div className="flex items-center gap-1 text-[9px] font-black text-primary uppercase tracking-[0.2em]">
                      <ShieldCheck className="size-3" /> SoundKit Verified
                    </div>
                  </div>
                  <h1 className="text-4xl md:text-6xl font-black font-[family-name:var(--font-playfair)] tracking-tight leading-none uppercase">
                    {project.title}
                  </h1>
                  <Link
                    to="/artist/$username"
                    params={{ username: project.artistSlug }}
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors group mt-2"
                  >
                    <span className="font-bold text-lg">{project.artist}</span>
                    <CheckCircle2 className="size-4 text-primary fill-primary/10" />
                  </Link>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <Button
                    size="lg"
                    onClick={playAlbum}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-10 h-12 uppercase tracking-widest"
                  >
                    <Play className="size-4 mr-2 fill-current" /> Play Album
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleLike}
                    className={`size-12 rounded-full border border-border/20 ${isLiked ? "text-rose-500 border-rose-500/50 bg-rose-500/10" : ""}`}
                  >
                    <Heart
                      className={`size-5 ${isLiked ? "fill-current" : ""}`}
                    />
                  </Button>
                </div>

                <div className="flex items-center gap-8 pt-4 border-t border-border/10 text-sm font-black uppercase tracking-widest text-muted-foreground/60">
                  <div className="flex items-center gap-2">
                    <Headphones className="size-4 text-emerald-500" />
                    <span>{project.plays} STREAMS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ListMusic className="size-4 text-primary" />
                    <span>{project.tracks.length} TRACKS</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Tracklist */}
            <section className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground px-2">
                Tracklist
              </h3>
              <div className="bg-card/40 border border-border/40 rounded-2xl overflow-hidden shadow-sm">
                <div className="divide-y divide-border/10">
                  {project.tracks.map((t, idx) => (
                    <div
                      key={t.id}
                      className="group flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-all cursor-pointer"
                      onClick={() => playSingleTrack(t)}
                    >
                      <div className="w-6 text-center text-xs font-black text-muted-foreground/40 group-hover:text-primary">
                        {(idx + 1).toString().padStart(2, "0")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-foreground truncate">
                            {t.title}
                          </p>
                          {t.explicit && (
                            <Badge
                              variant="outline"
                              className="h-3.5 px-1 text-[8px] border-border/60 text-muted-foreground"
                            >
                              E
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground/40 tracking-wider">
                          SoundKit Original
                        </p>
                      </div>
                      <div className="hidden sm:block text-[10px] font-mono text-muted-foreground/30 font-bold">
                        {t.plays}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-mono text-muted-foreground/60 font-bold">
                          {t.duration}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            playSingleTrack(t);
                          }}
                          className="size-8 rounded-lg text-muted-foreground/20 hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Play className="size-3.5 fill-current" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                              className="size-8 rounded-lg text-muted-foreground/40"
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-card/95 backdrop-blur-xl"
                          >
                            <DropdownMenuItem
                              onClick={() => playSingleTrack(t)}
                            >
                              Play Track
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                toast({
                                  description: `${t.title} added to queue.`,
                                  title: "Added to Queue",
                                });
                              }}
                            >
                              Add to Queue
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Project About */}
            <section className="space-y-4 px-2">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">
                Project Backstory
              </h3>
              <p className="text-muted-foreground leading-relaxed text-sm md:text-base italic">
                {project.description}
              </p>
            </section>

            {/* Visuals */}
            {project.associatedVideos.length > 0 && (
              <section className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground px-2">
                  Project Visuals
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {project.associatedVideos.map((video) => (
                    <Link
                      key={video.id}
                      to="/videos/$id"
                      params={{ id: video.id }}
                      className="group block space-y-3"
                    >
                      <div className="aspect-video rounded-xl overflow-hidden border border-border/40 relative shadow-lg">
                        <AppImage
                          src={video.thumbnail}
                          alt={video.title}
                          width={400}
                          height={225}
                          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="size-8 text-white fill-current" />
                        </div>
                      </div>
                      <p className="font-bold text-sm px-1 group-hover:text-primary transition-colors">
                        {video.title}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Sidebar - Commercial Focus */}
          <div className="lg:col-span-4 space-y-6">
            {/* Commercial Licensing Card */}
            <Card className="bg-emerald-500/5 border-emerald-500/20 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 uppercase text-[9px] font-black tracking-widest px-2">
                    Project License
                  </Badge>
                  <ShoppingCart className="size-4 text-emerald-500" />
                </div>
                <CardTitle className="text-3xl font-black tracking-tighter">
                  ${project.price}
                </CardTitle>
                <CardDescription className="text-xs font-bold uppercase tracking-widest text-emerald-500/60">
                  Full Album Bundle & Commercial Rights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 mb-6 text-[10px] font-bold uppercase tracking-tight text-foreground/80">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3 text-emerald-500" /> All{" "}
                    {project.tracks.length} tracks included
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3 text-emerald-500" />{" "}
                    Complete stems for every song
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3 text-emerald-500" />{" "}
                    Commercial distribution rights
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3 text-emerald-500" />{" "}
                    High-res artwork & digital PDF
                  </li>
                </ul>
                <Button
                  size="lg"
                  onClick={buyAlbum}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20"
                >
                  Buy Full Album
                </Button>
              </CardContent>
            </Card>

            {/* Minimal Artist Card */}
            <Card className="bg-card/40 border-border/40">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <Avatar className="size-16 border-2 border-border/40">
                    <AvatarImage src="/diverse-user-avatars.png" />
                    <AvatarFallback>LE</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-black text-lg uppercase leading-tight">
                      {project.artist}
                    </h4>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      R&B / Soul • Los Angeles
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6 text-center border-y border-border/10 py-4">
                  <div>
                    <p className="font-black text-base">124K</p>
                    <p className="text-[8px] uppercase font-black text-muted-foreground">
                      Followers
                    </p>
                  </div>
                  <div>
                    <p className="font-black text-base">1.2M</p>
                    <p className="text-[8px] uppercase font-black text-muted-foreground">
                      Listeners
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Button className="w-full font-bold uppercase text-xs tracking-widest h-11">
                    Follow Artist
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full font-bold uppercase text-xs tracking-widest h-11 border-border/40"
                  >
                    Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
