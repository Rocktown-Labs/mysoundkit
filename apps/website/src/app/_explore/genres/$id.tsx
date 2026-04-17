import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { ArtistCard } from "@/components/explore/artist-card";
import { BattleCard } from "@/components/explore/battle-card";
import { SectionHeader } from "@/components/explore/section-header";
import { TrackCard } from "@/components/explore/track-card";
import { Button } from "@/components/ui/button";

const genreData: Record<
  string,
  { name: string; emoji: string; description: string }
> = {
  afrobeats: {
    description: "African rhythms and melodies",
    emoji: "🥁",
    name: "Afrobeats",
  },
  electronic: {
    description: "Digital sounds and beats",
    emoji: "🎹",
    name: "Electronic",
  },
  "hip-hop": {
    description: "Beats, rhymes, and culture",
    emoji: "🎤",
    name: "Hip-Hop",
  },
  jazz: {
    description: "Improvisation and swing",
    emoji: "🎺",
    name: "Jazz",
  },
  latin: {
    description: "Latin rhythms and passion",
    emoji: "💃",
    name: "Latin",
  },
  pop: {
    description: "Chart-topping hits",
    emoji: "⭐",
    name: "Pop",
  },
  "rb-soul": {
    description: "Smooth vibes and soulful vocals",
    emoji: "🎵",
    name: "R&B/Soul",
  },
  rock: {
    description: "Guitar-driven anthems",
    emoji: "🎸",
    name: "Rock",
  },
};

export const Route = createFileRoute("/_explore/genres/$id")({
  component: GenreDetailPage,
});

function GenreDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const genre = genreData[id] || {
    description: "",
    emoji: "🎵",
    name: "Genre",
  };

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 space-y-8 md:space-y-10">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.history.back()}
        className="mb-4"
      >
        <ArrowLeft className="size-4 mr-2" />
        Back
      </Button>

      {/* Genre Header */}
      <div>
        <div className="flex items-center gap-4 mb-2">
          <div className="text-5xl md:text-6xl">{genre.emoji}</div>
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
              {genre.name}
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              {genre.description}
            </p>
          </div>
        </div>
      </div>

      {/* Top Tracks */}
      <section>
        <SectionHeader
          title={`Top ${genre.name} Tracks`}
          description="Most popular this week"
        />
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
          <div className="flex gap-3 md:gap-4 min-w-max">
            <TrackCard
              id="track-1"
              title="Summer Nights"
              artist="Luna Eclipse"
              artistSlug="luna-eclipse"
              cover="/summer-music-album-cover.png"
              plays="2.4M"
              duration="3:24"
            />
            <TrackCard
              id="track-2"
              title="Midnight Dreams"
              artist="Neon Pulse"
              artistSlug="neon-pulse"
              cover="/night-music-album-cover.png"
              plays="1.8M"
              duration="4:12"
            />
            <TrackCard
              id="track-3"
              title="Urban Legends"
              artist="Street Poet"
              artistSlug="street-poet"
              cover="/hip-hop-album-cover.png"
              plays="3.1M"
              duration="3:45"
            />
            <TrackCard
              id="track-4"
              title="Electric Soul"
              artist="Voltage Dreams"
              artistSlug="voltage-dreams"
              cover="/summer-music-album-cover.png"
              plays="1.2M"
              duration="3:56"
            />
            <TrackCard
              id="track-5"
              title="Neon Lights"
              artist="Luna Eclipse"
              artistSlug="luna-eclipse"
              cover="/night-music-album-cover.png"
              plays="1.9M"
              duration="3:30"
            />
            <TrackCard
              id="track-6"
              title="City Vibes"
              artist="Street Poet"
              artistSlug="street-poet"
              cover="/hip-hop-album-cover.png"
              plays="2.2M"
              duration="4:05"
            />
          </div>
        </div>
      </section>

      {/* New Tracks */}
      <section>
        <SectionHeader
          title={`New ${genre.name} Tracks`}
          description="Fresh releases this week"
        />
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
          <div className="flex gap-3 md:gap-4 min-w-max">
            <TrackCard
              id="track-7"
              title="Rising Star"
              artist="Voltage Dreams"
              artistSlug="voltage-dreams"
              cover="/summer-music-album-cover.png"
              plays="45K"
              duration="3:18"
            />
            <TrackCard
              id="track-8"
              title="New Wave"
              artist="Neon Pulse"
              artistSlug="neon-pulse"
              cover="/night-music-album-cover.png"
              plays="67K"
              duration="3:52"
            />
            <TrackCard
              id="track-9"
              title="Breaking Through"
              artist="Luna Eclipse"
              artistSlug="luna-eclipse"
              cover="/hip-hop-album-cover.png"
              plays="89K"
              duration="4:20"
            />
            <TrackCard
              id="track-10"
              title="Fresh Start"
              artist="Street Poet"
              artistSlug="street-poet"
              cover="/summer-music-album-cover.png"
              plays="52K"
              duration="3:45"
            />
            <TrackCard
              id="track-11"
              title="Morning Light"
              artist="Voltage Dreams"
              artistSlug="voltage-dreams"
              cover="/night-music-album-cover.png"
              plays="38K"
              duration="3:15"
            />
          </div>
        </div>
      </section>

      {/* Top Artists */}
      <section>
        <SectionHeader
          title={`Top ${genre.name} Artists`}
          description="Leading artists in this genre"
        />
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
          <div className="flex gap-3 md:gap-4 min-w-max">
            <ArtistCard
              slug="luna-eclipse"
              name="Luna Eclipse"
              avatar="/diverse-user-avatars.png"
              genre={genre.name}
              followers="124K"
              verified
            />
            <ArtistCard
              slug="neon-pulse"
              name="Neon Pulse"
              avatar="/diverse-user-avatars.png"
              genre={genre.name}
              followers="89K"
            />
            <ArtistCard
              slug="street-poet"
              name="Street Poet"
              avatar="/diverse-user-avatars.png"
              genre={genre.name}
              followers="256K"
              verified
            />
            <ArtistCard
              slug="voltage-dreams"
              name="Voltage Dreams"
              avatar="/diverse-user-avatars.png"
              genre={genre.name}
              followers="67K"
            />
            <ArtistCard
              slug="cosmic-waves"
              name="Cosmic Waves"
              avatar="/diverse-user-avatars.png"
              genre={genre.name}
              followers="145K"
              verified
            />
            <ArtistCard
              slug="rhythm-master"
              name="Rhythm Master"
              avatar="/diverse-user-avatars.png"
              genre={genre.name}
              followers="98K"
            />
          </div>
        </div>
      </section>

      {/* Live Battles */}
      <section>
        <SectionHeader title="Live Battles" description="Watch and vote now" />
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
          <div className="flex gap-3 md:gap-4 min-w-max">
            <BattleCard
              id="battle-1"
              title={`${genre.name} Showdown`}
              track1={{
                artist: "Artist A",
                cover: "/summer-music-album-cover.png",
                title: "Track One",
                votes: 1247,
              }}
              track2={{
                artist: "Artist B",
                cover: "/night-music-album-cover.png",
                title: "Track Two",
                votes: 1089,
              }}
              endsIn="2h 34m"
              genre={genre.name}
              live
            />
            <BattleCard
              id="battle-2"
              title={`${genre.name} Challenge`}
              track1={{
                artist: "Artist C",
                cover: "/hip-hop-album-cover.png",
                title: "Track Three",
                votes: 892,
              }}
              track2={{
                artist: "Artist D",
                cover: "/summer-music-album-cover.png",
                title: "Track Four",
                votes: 756,
              }}
              endsIn="1h 18m"
              genre={genre.name}
              live
            />
            <BattleCard
              id="battle-3"
              title="Beat Battle"
              track1={{
                artist: "Luna Eclipse",
                cover: "/night-music-album-cover.png",
                title: "Rhythm Fire",
                votes: 654,
              }}
              track2={{
                artist: "Neon Pulse",
                cover: "/hip-hop-album-cover.png",
                title: "Bass Drop",
                votes: 589,
              }}
              endsIn="45m"
              genre={genre.name}
              live
            />
          </div>
        </div>
      </section>

      {/* Upcoming Battles */}
      <section>
        <SectionHeader
          title="Upcoming Battles"
          description="Get ready to vote"
        />
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
          <div className="flex gap-3 md:gap-4 min-w-max">
            <BattleCard
              id="battle-4"
              title={`${genre.name} Finals`}
              track1={{
                artist: "Street Poet",
                cover: "/summer-music-album-cover.png",
                title: "Champion Sound",
                votes: 0,
              }}
              track2={{
                artist: "Voltage Dreams",
                cover: "/night-music-album-cover.png",
                title: "Victory Lap",
                votes: 0,
              }}
              startsIn="3h 20m"
              genre={genre.name}
            />
            <BattleCard
              id="battle-5"
              title="Producer Clash"
              track1={{
                artist: "Cosmic Waves",
                cover: "/hip-hop-album-cover.png",
                title: "Beat Master",
                votes: 0,
              }}
              track2={{
                artist: "Rhythm Master",
                cover: "/summer-music-album-cover.png",
                title: "Rhythm King",
                votes: 0,
              }}
              startsIn="6h 45m"
              genre={genre.name}
            />
          </div>
        </div>
      </section>

      {/* Must See Battles */}
      <section>
        <SectionHeader
          title="Must See Battles"
          description="Most watched battles"
        />
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
          <div className="flex gap-3 md:gap-4 min-w-max">
            <BattleCard
              id="battle-6"
              title="Epic Clash"
              track1={{
                artist: "Luna Eclipse",
                cover: "/night-music-album-cover.png",
                title: "Legendary",
                votes: 15_234,
              }}
              track2={{
                artist: "Street Poet",
                cover: "/hip-hop-album-cover.png",
                title: "Immortal",
                votes: 14_876,
              }}
              views="245K"
              genre={genre.name}
            />
            <BattleCard
              id="battle-7"
              title="Battle of the Year"
              track1={{
                artist: "Neon Pulse",
                cover: "/summer-music-album-cover.png",
                title: "Unstoppable",
                votes: 12_456,
              }}
              track2={{
                artist: "Voltage Dreams",
                cover: "/night-music-album-cover.png",
                title: "Invincible",
                votes: 11_987,
              }}
              views="189K"
              genre={genre.name}
            />
            <BattleCard
              id="battle-8"
              title="Greatest Hits"
              track1={{
                artist: "Cosmic Waves",
                cover: "/hip-hop-album-cover.png",
                title: "Classic",
                votes: 9876,
              }}
              track2={{
                artist: "Rhythm Master",
                cover: "/summer-music-album-cover.png",
                title: "Timeless",
                votes: 9543,
              }}
              views="167K"
              genre={genre.name}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
