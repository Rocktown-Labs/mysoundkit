"use client";

import { useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  MapPin,
  MessageCircle,
  PlayCircle,
  Send,
  Settings,
  Share2,
  Swords,
  Trophy,
  UserPlus,
} from "lucide-react";
import { useState } from "react";

import { FloatingChatBar } from "@/components/dashboard/floating-chat-bar";
import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AppleMusicIcon,
  InstagramIcon,
  SpotifyIcon,
  TikTokIcon,
  TwitterIcon,
  YoutubeMusicIcon,
} from "@/components/ui/brand-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { canShowChallengeAction } from "@/lib/live-experience";
import { absoluteSiteUrl } from "@/lib/seo";
import { shareLink } from "@/lib/share";
import { useFollowArtistMutation } from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

interface ProfileShellProps {
  children: React.ReactNode;
  isOwner?: boolean;
  targetIsArtist?: boolean;
  user: {
    avatar: string;
    battleRank?: string;
    battleRecord?: string;
    bio: string;
    coverImage: string;
    followers: string;
    following: string;
    genre: string;
    joinedDate: string;
    links: {
      apple?: string;
      appleMusic?: string;
      instagram?: string;
      personalSite?: string;
      soundcloud?: string;
      spotify?: string;
      tiktok?: string;
      twitter?: string;
      youtube?: string;
    };
    location: string;
    monthlyListeners?: string;
    name: string;
    tracks: number;
    username: string;
    verified: boolean;
  };
  viewerAccountType?: "artist" | "fan" | null;
}

export function ProfileShell({
  children,
  isOwner,
  targetIsArtist = true,
  user,
  viewerAccountType,
}: ProfileShellProps) {
  const router = useRouter();
  const followArtist = useFollowArtistMutation(user.username);
  const [followerCount, setFollowerCount] = useState(user.followers);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const showChallenge = canShowChallengeAction({
    isOwner: Boolean(isOwner),
    targetIsArtist,
    viewerAccountType,
  });

  const appleMusicLink = user.links.appleMusic ?? user.links.apple;

  const listenLinks = [
    user.links.spotify
      ? {
          href: user.links.spotify,
          icon: SpotifyIcon,
          label: "Spotify",
          tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500",
        }
      : null,
    appleMusicLink
      ? {
          href: appleMusicLink,
          icon: AppleMusicIcon,
          label: "Apple Music",
          tone: "border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500",
        }
      : null,
    user.links.youtube
      ? {
          href: user.links.youtube,
          icon: YoutubeMusicIcon,
          label: "YouTube",
          tone: "border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500",
        }
      : null,
  ].filter((link): link is Exclude<typeof link, null> => Boolean(link));

  const followLinks = [
    user.links.instagram
      ? { href: user.links.instagram, icon: InstagramIcon, label: "Instagram" }
      : null,
    user.links.twitter
      ? { href: user.links.twitter, icon: TwitterIcon, label: "X" }
      : null,
    user.links.tiktok
      ? { href: user.links.tiktok, icon: TikTokIcon, label: "TikTok" }
      : null,
    user.links.soundcloud
      ? { href: user.links.soundcloud, icon: SpotifyIcon, label: "SoundCloud" }
      : null,
    user.links.personalSite
      ? { href: user.links.personalSite, icon: Globe, label: "Website" }
      : null,
  ].filter((link): link is Exclude<typeof link, null> => Boolean(link));

  const handleFollow = async () => {
    const result = await followArtist.mutateAsync();
    setFollowerCount(result.followerCount.toLocaleString());
  };

  const profileShareUrl = absoluteSiteUrl(`/artist/${user.username}`);
  const profileShareTitle = `Check out ${user.name} on SoundKit`;
  const profileShareText = `Follow @${user.username} on SoundKit.`;

  const handleNativeShare = async () => {
    const outcome = await shareLink({
      text: profileShareText,
      title: profileShareTitle,
      url: profileShareUrl,
    });

    if (outcome === "shared") {
      setIsShareOpen(false);
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

    setIsShareOpen(false);
    toast({
      description: `Profile URL copied to clipboard: ${profileShareUrl}`,
      title: "Link Copied",
    });
  };

  const handleCopyLink = () => {
    void navigator.clipboard
      .writeText(profileShareUrl)
      .then(() => {
        toast({
          description: `Profile URL copied to clipboard: ${profileShareUrl}`,
          title: "Link Copied",
        });
      })
      .catch(() => {});
  };

  const handleShareApp = (platform: "twitter" | "facebook" | "whatsapp") => {
    const url = encodeURIComponent(profileShareUrl);
    const text = encodeURIComponent(profileShareTitle);

    let shareUrl = "";
    if (platform === "twitter") {
      shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    } else if (platform === "whatsapp") {
      shareUrl = `https://api.whatsapp.com/send?text=${text}%20${url}`;
    } else if (platform === "facebook") {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    }

    if (shareUrl) {
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Cover Section */}
      <div className="relative h-[250px] md:h-[400px] w-full overflow-hidden group">
        <AppImage
          src={user.coverImage || "/hip-hop-battle-stage.jpg"}
          alt="Cover"
          width={1920}
          height={400}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

        {/* Top Actions */}
        <div className="absolute top-4 left-4 right-4 flex justify-between z-10">
          {!isOwner && (
            <Button
              variant="secondary"
              size="icon"
              onClick={() => router.history.back()}
              className="rounded-full bg-black/20 backdrop-blur-md border-white/10 hover:bg-black/40"
            >
              <ArrowLeft className="size-5" />
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIsShareOpen(true)}
              className="rounded-full bg-black/20 backdrop-blur-md border-white/10 hover:bg-black/40"
            >
              <Share2 className="size-4" />
            </Button>
            {isOwner && (
              <Button
                variant="secondary"
                size="icon"
                onClick={() =>
                  router.navigate({ to: "/dashboard/career/settings" as any })
                }
                className="rounded-full bg-black/20 backdrop-blur-md border-white/10 hover:bg-black/40"
              >
                <Settings className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Header Card */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-28 md:-mt-36 z-20">
          <div className="bg-card/40 backdrop-blur-3xl border border-border/40 rounded-3xl p-6 md:p-10 shadow-2xl overflow-hidden relative group/card">
            <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
              {/* Avatar */}
              <div className="relative group shrink-0 mx-auto md:mx-0">
                <Avatar className="size-32 md:size-48 border-4 border-card relative">
                  <AvatarImage src={user.avatar} className="object-cover" />
                  <AvatarFallback className="text-4xl">
                    {user.name[0]}
                  </AvatarFallback>
                </Avatar>
                {user.verified && (
                  <div className="absolute bottom-2 right-2 bg-primary rounded-full p-2 border-4 border-card shadow-lg">
                    <CheckCircle2 className="size-4 md:size-6 text-primary-foreground" />
                  </div>
                )}
              </div>

              {/* Info & Actions */}
              <div className="flex-1 min-w-0 space-y-6 w-full">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                  <div className="space-y-1.5 text-center sm:text-left">
                    <h1 className="text-4xl md:text-5xl font-black font-[family-name:var(--font-playfair)] tracking-tight leading-none">
                      {user.name}
                    </h1>
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <p className="text-primary font-bold tracking-wide">
                        @{user.username}
                      </p>
                      <Badge
                        variant="outline"
                        className="h-5 px-1.5 text-[9px] uppercase tracking-widest border-primary/30 text-primary bg-primary/5"
                      >
                        {user.genre}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    {isOwner ? (
                      <>
                        <Button
                          onClick={() =>
                            router.navigate({
                              to: "/dashboard/career/settings" as any,
                            })
                          }
                          className="rounded-full shadow-lg shadow-primary/20 px-8 font-bold h-11"
                        >
                          Edit Profile
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full border-border/40 bg-white/5 h-11 px-6 font-bold"
                          asChild
                        >
                          <a
                            href={`/artist/${user.username}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="size-4 mr-2" />
                            Public
                          </a>
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          className="rounded-full shadow-xl shadow-primary/30 px-8 font-bold h-11"
                          disabled={followArtist.isPending}
                          onClick={() => void handleFollow()}
                          type="button"
                        >
                          <UserPlus className="size-4 mr-2" />
                          {followArtist.isPending ? "Following..." : "Follow"}
                        </Button>
                        {showChallenge && (
                          <Button
                            variant="secondary"
                            className="rounded-full border-border/40 bg-primary/15 h-11 px-5 font-bold text-primary"
                            onClick={() =>
                              router.navigate({
                                search: { opponent: user.username } as never,
                                to: "/dashboard/live/challenge" as any,
                              })
                            }
                          >
                            <Swords className="mr-2 size-4" />
                            Challenge
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Primary Stats Row: Inline on Mobile & Desktop */}
                <div className="flex items-center justify-around sm:justify-start gap-4 md:gap-8 py-5 border-y border-border/10 overflow-x-auto">
                  <div className="text-center sm:text-left pr-4 border-r border-border/10">
                    <p className="text-xl font-black text-foreground">
                      {user.tracks}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-black">
                      Tracks
                    </p>
                  </div>
                  <div className="text-center sm:text-left pr-4 border-r border-border/10">
                    <p className="text-xl font-black text-foreground">
                      {followerCount}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-black">
                      Followers
                    </p>
                  </div>
                  <div className="text-center sm:text-left pr-4 border-r border-border/10">
                    <p className="text-xl font-black text-foreground">
                      {user.battleRank ?? "#NR"}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-black flex items-center gap-1">
                      <Trophy className="size-2.5" /> Rank
                    </p>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-xl font-black text-foreground">
                      {user.monthlyListeners || "0"}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-black flex items-center gap-1">
                      <PlayCircle className="size-2.5" /> Listeners
                    </p>
                  </div>
                </div>

                {/* Bio & Links Section */}
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="flex-1 space-y-4">
                    <p className="text-base text-muted-foreground leading-relaxed italic max-w-xl whitespace-pre-line">
                      "{user.bio}"
                    </p>
                    <div className="flex flex-wrap items-center gap-6 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 text-primary" />
                        {user.location}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="size-4" />
                        Joined {user.joinedDate}
                      </div>
                      <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/5 px-2 py-1 rounded-md border border-emerald-500/10">
                        <Swords className="size-4" />
                        Record: {user.battleRecord || "0-0"}
                      </div>
                    </div>
                  </div>

                  {/* Listen On & Follow On Links (Side by Side on Mobile in 2 Columns) */}
                  <div className="grid grid-cols-2 lg:flex lg:flex-col gap-6 lg:w-56">
                    {/* Listen On Column */}
                    {listenLinks.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/50">
                          Listen On
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {listenLinks.map((link) => {
                            const Icon = link.icon;
                            return (
                              <a
                                key={link.label}
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={link.label}
                                className={cn(
                                  "size-9 rounded-full border flex items-center justify-center transition-all shadow hover:scale-110",
                                  link.tone
                                )}
                              >
                                <Icon className="size-4" />
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Follow On Column */}
                    {followLinks.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/50">
                          Follow On
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {followLinks.map((link) => {
                            const Icon = link.icon;
                            return (
                              <a
                                key={link.label}
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={link.label}
                                className="size-9 rounded-full border border-border/40 bg-muted/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow hover:scale-110"
                              >
                                <Icon className="size-4" />
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Child Content */}
        <div className="mt-8">{children}</div>
      </div>

      {/* Floating Chat Bar Component */}
      <FloatingChatBar />

      {/* Share Options Modal */}
      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-5 text-primary" /> Share Artist Profile
            </DialogTitle>
            <DialogDescription>
              Share @{user.username} with friends or post to external platforms.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-3">
            <Button
              className="justify-start gap-3 h-12"
              onClick={() => void handleNativeShare()}
            >
              <Share2 className="size-4" />
              <span className="font-semibold text-sm">Share Profile</span>
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-3 h-12"
              onClick={handleCopyLink}
            >
              <Copy className="size-4 text-primary" />
              <span className="font-semibold text-sm">Copy Profile Link</span>
            </Button>

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleShareApp("twitter")}
              >
                X / Twitter
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleShareApp("whatsapp")}
              >
                WhatsApp
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleShareApp("facebook")}
              >
                Facebook
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
