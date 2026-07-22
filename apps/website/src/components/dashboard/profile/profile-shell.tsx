"use client";

import { useRouter } from "@tanstack/react-router";
import {
  MapPin,
  CheckCircle2,
  Share2,
  Settings,
  ArrowLeft,
  Calendar,
  ExternalLink,
  MessageCircle,
  UserPlus,
  Trophy,
  Swords,
  Users as UsersIcon,
  PlayCircle,
} from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AppleMusicIcon,
  SpotifyIcon,
  YoutubeMusicIcon,
} from "@/components/ui/brand-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProfileShellProps {
  user: {
    name: string;
    username: string;
    avatar: string;
    coverImage: string;
    bio: string;
    location: string;
    genre: string;
    followers: string;
    following: string;
    tracks: number;
    verified: boolean;
    joinedDate: string;
    battleRank?: string;
    battleRecord?: string;
    monthlyListeners?: string;
    links: {
      instagram?: string;
      twitter?: string;
      youtube?: string;
      spotify?: string;
      apple?: string;
    };
  };
  isOwner?: boolean;
  children: React.ReactNode;
}

export function ProfileShell({ user, isOwner, children }: ProfileShellProps) {
  const router = useRouter();

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
            {/* Ambient Background Accents */}
            <div className="absolute -top-24 -right-24 size-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 size-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
              {/* Avatar Section */}
              <div className="relative group shrink-0 mx-auto md:mx-0">
                <div className="absolute -inset-1 bg-gradient-to-br from-primary via-purple-500 to-blue-500 rounded-full blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200" />
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

              {/* Info Section */}
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
                        <Button className="rounded-full shadow-xl shadow-primary/30 px-10 font-bold h-12 text-lg">
                          <UserPlus className="size-5 mr-2" />
                          Follow
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full border-border/40 bg-white/5 h-12 w-12 p-0 shadow-lg"
                        >
                          <MessageCircle className="size-6" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Primary Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 py-6 border-y border-border/10">
                  <div className="text-center sm:text-left border-r border-border/10 pr-4">
                    <p className="text-xl font-black text-foreground">
                      {user.tracks}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-black">
                      Tracks
                    </p>
                  </div>
                  <div className="text-center sm:text-left border-r border-border/10 pr-4">
                    <p className="text-xl font-black text-foreground">
                      {user.followers}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-black">
                      Followers
                    </p>
                  </div>
                  <div className="text-center sm:text-left border-r border-border/10 pr-4">
                    <p className="text-xl font-black text-foreground">
                      {user.battleRank ? (
                        user.battleRank
                      ) : (
                        <span className="text-sm font-semibold text-muted-foreground">
                          Unranked
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-black flex items-center gap-1 justify-center sm:justify-start">
                      <Trophy className="size-2.5" /> Rank
                    </p>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-xl font-black text-foreground">
                      {user.monthlyListeners || "42.5K"}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-black flex items-center gap-1 justify-center sm:justify-start">
                      <PlayCircle className="size-2.5" /> Listeners
                    </p>
                  </div>
                </div>

                {/* Bio & Extended Stats */}
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="flex-1 space-y-4">
                    <p className="text-base text-muted-foreground leading-relaxed italic max-w-xl">
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
                        Record: {user.battleRecord || "24-4"}
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Platform Links */}
                  <div className="flex flex-col gap-3 lg:w-48">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/40 text-center lg:text-left">
                      Listen on
                    </p>
                    <div className="flex items-center justify-center lg:justify-start gap-4">
                      {user.links.spotify && (
                        <a
                          href={user.links.spotify}
                          target="_blank"
                          rel="noreferrer"
                          className="size-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/10 hover:scale-110"
                        >
                          <SpotifyIcon className="size-5" />
                        </a>
                      )}
                      {user.links.apple && (
                        <a
                          href={user.links.apple}
                          target="_blank"
                          rel="noreferrer"
                          className="size-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-lg shadow-rose-500/10 hover:scale-110"
                        >
                          <AppleMusicIcon className="size-5" />
                        </a>
                      )}
                      {user.links.youtube && (
                        <a
                          href={user.links.youtube}
                          target="_blank"
                          rel="noreferrer"
                          className="size-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/10 hover:scale-110"
                        >
                          <YoutubeMusicIcon className="size-5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="mt-12">{children}</div>
      </div>
    </div>
  );
}
