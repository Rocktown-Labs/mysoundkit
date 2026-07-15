import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Play,
  Trophy,
  Zap,
  Eye,
  Headphones,
  Radio,
  Clock,
  Bell,
  Users,
  Music,
} from "lucide-react";
import { useState, useEffect } from "react";

import { BattleCard } from "@/components/explore/battle-card";
import { ListeningPartyCard } from "@/components/explore/listening-party-card";
import {
  liveDiscoveryGenres,
  partyDiscoveryItems,
  streamDiscoveryItems,
} from "@/components/explore/live-discovery-data";
import { SectionHeader } from "@/components/explore/section-header";
import { StreamCard } from "@/components/explore/stream-card";
import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_explore/live/")({
  component: LiveHubPage,
});

function LiveHubPage() {
  const [selectedLocation, setSelectedLocation] = useState("California");
  const [viewMode, setViewMode] = useState<"usa" | "global">("usa");
  const [selectedState, setSelectedState] = useState("USA");

  const usStates = [
    "USA",
    "California",
    "New York",
    "Texas",
    "Florida",
    "Illinois",
    "Georgia",
    "Pennsylvania",
  ];

  return (
    <>
      {/* Live Battles - Premium Gated (Mocked in button) */}
      <section id="live-battles" className="mb-8 md:mb-12">
        <SectionHeader
          title="Live Battles"
          description="Epic head-to-head matchups."
          icon={<Zap className="size-6 text-primary" />}
          viewAllHref="/live/battles"
        />

        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-4 scrollbar-hide">
          <div className="flex gap-4 md:gap-6 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-w-max md:min-w-0">
            <BattleCard
              id="battle-1"
              title="West Coast Showdown"
              track1={{
                artist: "DJ Nova",
                cover: "/summer-music-album-cover.png",
                title: "Midnight Drive",
                votes: 1247,
              }}
              track2={{
                artist: "MC Rhythm",
                cover: "/night-music-album-cover.png",
                title: "City Lights",
                votes: 1089,
              }}
              endsIn="2h 34m"
              genre="Hip-Hop"
              isLive={true}
              currentRound={2}
              totalRounds={3}
              isVoting={false}
              queueSize={12}
            />
            <BattleCard
              id="battle-2"
              title="Bay Area Beats"
              track1={{
                artist: "Sunset Collective",
                cover: "/hip-hop-album-cover.png",
                title: "Golden Hour",
                votes: 892,
              }}
              track2={{
                artist: "Urban Echo",
                cover: "/summer-music-album-cover.png",
                title: "Neon Nights",
                votes: 756,
              }}
              endsIn="5h 12m"
              genre="R&B"
              isLive={true}
              currentRound={1}
              totalRounds={5}
              isVoting={true}
              queueSize={45}
            />
            <BattleCard
              id="battle-3"
              title="LA Underground"
              track1={{
                artist: "Sub Frequency",
                cover: "/night-music-album-cover.png",
                title: "Bassline Theory",
                votes: 2156,
              }}
              track2={{
                artist: "Beat Architect",
                cover: "/hip-hop-album-cover.png",
                title: "Rhythm Code",
                votes: 1998,
              }}
              endsIn="1h 05m"
              genre="Electronic"
              isLive={true}
              currentRound={3}
              totalRounds={3}
              isVoting={false}
              queueSize={8}
            />
          </div>
        </div>
      </section>

      {/* Live Listening Parties - Available to All */}
      <section className="mb-8 md:mb-12">
        <SectionHeader
          title="Live Listening Parties"
          description="Vibe together, discover new music, and chat with other fans."
          icon={<Headphones className="size-6 text-primary" />}
          viewAllHref="/live/parties"
        />
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-4 scrollbar-hide">
          <div className="flex gap-4 md:gap-6 min-w-max md:min-w-0">
            <ListeningPartyCard
              id="party-1"
              title="Midnight Synthwave Session"
              hostName="DJ Retro"
              currentTrack="Neon Dreams - Lazer Hawk"
              listenerCount={1204}
              albumCovers={[
                "/summer-music-album-cover.png",
                "/night-music-album-cover.png",
                "/hip-hop-album-cover.png",
              ]}
              isLive={true}
            />
            <ListeningPartyCard
              id="party-2"
              title="Lofi Study Beats"
              hostName="Chill Vibes Co."
              currentTrack="Rainy Days - Nujabes"
              listenerCount={3400}
              albumCovers={[
                "/hip-hop-album-cover.png",
                "/summer-music-album-cover.png",
              ]}
              isLive={true}
            />
            <ListeningPartyCard
              id="party-3"
              title="New Music Friday Preview"
              hostName="SoundKit Curators"
              currentTrack="Unreleased Track - Top Artist"
              listenerCount={8900}
              albumCovers={[
                "/night-music-album-cover.png",
                "/summer-music-album-cover.png",
                "/hip-hop-album-cover.png",
              ]}
              isLive={true}
            />
          </div>
        </div>
      </section>

      {/* Live Creator Streams - Premium Gated via Link/Action later, here just display */}
      <section className="mb-8 md:mb-12">
        <SectionHeader
          title="Creator Streams"
          description="Watch producers make beats and artists track vocals live."
          icon={<Radio className="size-6 text-primary" />}
          viewAllHref="/live/streams"
        />
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-4 scrollbar-hide">
          <div className="flex gap-4 md:gap-6 min-w-max md:min-w-0">
            <StreamCard
              id="stream-1"
              title="Making a beat from scratch"
              creatorName="Metro Boomin"
              creatorAvatar="/diverse-user-avatars.png"
              thumbnailUrl="/music-battle-video-thumbnail.jpg"
              viewerCount={15_400}
              category="Production"
            />
            <StreamCard
              id="stream-2"
              title="Vocal Tracking Session"
              creatorName="Ariana"
              creatorAvatar="/diverse-user-avatars.png"
              thumbnailUrl="/hip-hop-battle-stage.jpg"
              viewerCount={32_100}
              category="Recording"
            />
            <StreamCard
              id="stream-3"
              title="Mixing & Mastering Q&A"
              creatorName="Mike Dean"
              creatorAvatar="/diverse-user-avatars.png"
              thumbnailUrl="/rap-battle-crowd.jpg"
              viewerCount={8500}
              category="Mixing"
            />
          </div>
        </div>
      </section>

      <section className="mb-8 md:mb-12">
        <SectionHeader
          title="Browse Live By Genre"
          description="Find parties and streams in the lanes you care about."
          icon={<Music className="size-6 text-primary" />}
          viewAllHref="/live"
        />
        <div className="space-y-8">
          {liveDiscoveryGenres.map((genre) => {
            const parties = partyDiscoveryItems.filter(
              (party) => party.genre === genre
            );
            const streams = streamDiscoveryItems.filter(
              (stream) => stream.genre === genre
            );

            if (parties.length === 0 && streams.length === 0) {
              return null;
            }

            return (
              <div key={genre} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{genre}</h3>
                  <Link
                    to="/live"
                    className="text-muted-foreground text-sm hover:text-primary"
                  >
                    View All
                  </Link>
                </div>
                <div className="overflow-x-auto pb-2">
                  <div className="flex min-w-max gap-4 md:gap-6">
                    {parties.map((party) => (
                      <ListeningPartyCard key={party.id} {...party} />
                    ))}
                    {streams.map((stream) => (
                      <StreamCard key={stream.id} {...stream} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Battle Leaderboard */}
      <section className="mb-8 md:mb-12">
        <SectionHeader
          title="Battle Leaderboard"
          description="Top artists in the battle scene"
          icon={<Trophy className="size-6 text-primary" />}
          viewAllHref="/live/battles/leaderboard"
        />

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <Select
            value={viewMode === "usa" ? selectedState : ""}
            onValueChange={(value) => {
              setViewMode("usa");
              setSelectedState(value);
              setSelectedLocation(value);
            }}
            disabled={viewMode === "global"}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select US location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USA-header" disabled className="font-semibold">
                🇺🇸 United States
              </SelectItem>
              {usStates.map((state) => (
                <SelectItem key={state} value={state}>
                  {state === "USA" ? "All USA" : state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={viewMode === "global" ? selectedLocation : ""}
            onValueChange={(value) => {
              setViewMode("global");
              setSelectedLocation(value);
            }}
            disabled={viewMode === "usa"}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select global region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">🌍 All Global</SelectItem>
              <SelectItem value="africa">🌍 Africa</SelectItem>
              <SelectItem value="europe">🌍 Europe</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto pb-4 scrollbar-hide">
          <div className="flex gap-4 md:gap-6">
            {/* Card 1: Ranks 1-4 */}
            <div className="shrink-0 w-[85vw] md:w-[400px] space-y-3">
              {[
                {
                  battles: 52,
                  city: "Los Angeles, CA",
                  flag: "🇺🇸",
                  name: "DJ Nova",
                  rank: 1,
                  wins: 47,
                },
                {
                  battles: 50,
                  city: "Brooklyn, NY",
                  flag: "🇺🇸",
                  name: "MC Rhythm",
                  rank: 2,
                  wins: 42,
                },
                {
                  battles: 45,
                  city: "Atlanta, GA",
                  flag: "🇺🇸",
                  name: "Luna Eclipse",
                  rank: 3,
                  wins: 38,
                },
                {
                  battles: 44,
                  city: "Houston, TX",
                  flag: "🇺🇸",
                  name: "Street Poet",
                  rank: 4,
                  wins: 35,
                },
              ].map((artist) => (
                <Link
                  key={artist.rank}
                  to="/artist/$username"
                  params={{
                    username: artist.name.toLowerCase().replace(" ", "-"),
                  }}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                      artist.rank === 1
                        ? "bg-yellow-500 text-yellow-950"
                        : artist.rank === 2
                          ? "bg-gray-400 text-gray-950"
                          : artist.rank === 3
                            ? "bg-amber-600 text-amber-950"
                            : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {artist.rank}
                  </div>
                  <Avatar className="size-10">
                    <AvatarImage src="/diverse-user-avatars.png" />
                    <AvatarFallback>{artist.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {artist.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {artist.city}
                    </div>
                  </div>
                  <div className="text-xl shrink-0">{artist.flag}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Must See Battles - Available to All */}
      <section className="mb-6 md:mb-8">
        <SectionHeader
          title="Must See Battles"
          description="Top viewed battles from the past week. Free for all users."
          icon={<Eye className="size-6 text-primary" />}
          viewAllHref="/live/battles/must-see"
        />

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap mb-4">
            <TabsTrigger value="all">All Genres</TabsTrigger>
            <TabsTrigger value="hip-hop">Hip-Hop</TabsTrigger>
            <TabsTrigger value="rnb">R&B</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-0">
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2">
              <div className="flex gap-4">
                {[
                  {
                    artist1: "Coast King",
                    artist2: "Bay Legend",
                    duration: "12:34",
                    id: "must-see-1",
                    thumbnail: "/music-battle-video-thumbnail.jpg",
                    title: "Epic Showdown: East vs West",
                    views: "2.4M",
                    winner: "Coast King",
                  },
                  {
                    artist1: "Beat Master",
                    artist2: "Rhythm Chief",
                    duration: "15:22",
                    id: "must-see-2",
                    thumbnail: "/hip-hop-battle-stage.jpg",
                    title: "Producer Battle: Beats & Rhymes",
                    views: "1.8M",
                    winner: "Rhythm Chief",
                  },
                ].map((battle) => (
                  <Link
                    key={battle.id}
                    to="/live/battles/$id"
                    params={{ id: battle.id }}
                    className="flex-shrink-0 w-[85vw] md:w-[600px] lg:w-[700px]"
                  >
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow group h-full border-border">
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row gap-0 sm:gap-4 h-full">
                          {/* Video Thumbnail */}
                          <div className="relative w-full sm:w-80 aspect-video sm:aspect-auto sm:h-auto shrink-0 overflow-hidden bg-muted">
                            <AppImage
                              src={battle.thumbnail || "/placeholder.svg"}
                              alt={battle.title}
                              width={700}
                              height={394}
                              layout="constrained"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="size-12 md:size-16 rounded-full bg-primary flex items-center justify-center">
                                <Play className="size-6 md:size-8 fill-primary-foreground text-primary-foreground ml-1" />
                              </div>
                            </div>
                            <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-semibold text-white">
                              {battle.duration}
                            </div>
                          </div>

                          {/* Battle Info */}
                          <div className="flex-1 p-4">
                            <h3 className="font-semibold text-base md:text-lg mb-2 group-hover:text-primary transition-colors truncate">
                              {battle.title}
                            </h3>
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="secondary" className="text-xs">
                                {battle.artist1}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                vs
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {battle.artist2}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                              <span className="flex items-center gap-1">
                                <Eye className="size-4" />
                                {battle.views} views
                              </span>
                              <span className="flex items-center gap-1">
                                <Trophy className="size-4 text-primary" />
                                Winner: {battle.winner}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="hip-hop">
            <p className="text-center text-muted-foreground py-8">
              Hip-Hop battles coming soon...
            </p>
          </TabsContent>

          <TabsContent value="rnb">
            <p className="text-center text-muted-foreground py-8">
              R&B battles coming soon...
            </p>
          </TabsContent>
        </Tabs>
      </section>
    </>
  );
}
