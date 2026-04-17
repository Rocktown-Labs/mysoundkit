import { createFileRoute, useRouter } from "@tanstack/react-router";
import { TrendingUp, Sparkles, Trophy } from "lucide-react";
import { useState, useEffect, useRef } from "react";

import { ArtistLeaderboardCard } from "@/components/explore/artist-leaderboard-card";
import { BattleFilters } from "@/components/explore/battle-filters";

const sortOptions = [
  { label: "Rank (High to Low)", value: "rank-asc" },
  { label: "Rank (Low to High)", value: "rank-desc" },
  { label: "Name (A-Z)", value: "name-asc" },
  { label: "Name (Z-A)", value: "name-desc" },
];

export const Route = createFileRoute("/_explore/artist/")({
  component: ArtistPage,
});

function ArtistPage() {
  const router = useRouter();
  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const isInitialMount = useRef(true);

  const [regionType, setRegionType] = useState<"north-america" | "global">(
    "north-america"
  );
  const [region, setRegion] = useState("all");
  const [genre, setGenre] = useState("all");
  const [sort, setSort] = useState("rank-asc");

  // Initialize from URL params or localStorage
  useEffect(() => {
    const urlRegionType = searchParams.get("regionType") as
      | "north-america"
      | "global"
      | null;
    const urlRegion = searchParams.get("region");
    const urlGenre = searchParams.get("genre");
    const urlSort = searchParams.get("sort");

    if (urlRegionType || urlRegion || urlGenre || urlSort) {
      if (urlRegionType) {
        setRegionType(urlRegionType);
      }
      if (urlRegion) {
        setRegion(urlRegion);
      }
      if (urlGenre) {
        setGenre(urlGenre);
      }
      if (urlSort) {
        setSort(urlSort);
      }
    } else {
      const savedRegionType = localStorage.getItem("exploreRegionType") as
        | "north-america"
        | "global"
        | null;
      const savedRegion = localStorage.getItem("exploreRegion");
      if (savedRegionType) {
        setRegionType(savedRegionType);
      }
      if (savedRegion) {
        setRegion(savedRegion);
      }
    }
  }, [searchParams]);

  // Update URL and localStorage on filter changes (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const params = new URLSearchParams();
    params.set("regionType", regionType);
    params.set("region", region);
    params.set("genre", genre);
    params.set("sort", sort);

    localStorage.setItem("exploreRegionType", regionType);
    localStorage.setItem("exploreRegion", region);
  }, [regionType, region, genre, sort, router]);

  const genres = [
    "All",
    "Hip-Hop",
    "R&B",
    "Pop",
    "Electronic",
    "Afrobeats",
    "Rock",
    "Jazz",
  ];

  const risingArtistsData = [
    // Set 1
    [
      {
        avatar: "/diverse-user-avatars.png",
        genre: "R&B/Soul",
        location: "Los Angeles, CA",
        name: "Luna Eclipse",
        rank: 1,
        slug: "luna-eclipse",
        stats: { followers: "124K", plays: "2.3M" },
        verified: true,
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Miami, FL",
        name: "Neon Pulse",
        rank: 2,
        slug: "neon-pulse",
        stats: { followers: "89K", plays: "1.9M" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Atlanta, GA",
        name: "Street Poet",
        rank: 3,
        slug: "street-poet",
        stats: { followers: "256K", plays: "1.7M" },
        verified: true,
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Synthwave",
        location: "Austin, TX",
        name: "Voltage Dreams",
        rank: 4,
        slug: "voltage-dreams",
        stats: { followers: "67K", plays: "1.5M" },
      },
    ],
    // Set 2
    [
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "New York, NY",
        name: "Metro Flow",
        rank: 5,
        slug: "metro-flow",
        stats: { followers: "198K", plays: "1.4M" },
        verified: true,
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "San Diego, CA",
        name: "Ocean Drive",
        rank: 6,
        slug: "ocean-drive",
        stats: { followers: "145K", plays: "1.2M" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Chicago, IL",
        name: "Rhythm Soul",
        rank: 7,
        slug: "rhythm-soul",
        stats: { followers: "178K", plays: "1.1M" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Seattle, WA",
        name: "Bass Wave",
        rank: 8,
        slug: "bass-wave",
        stats: { followers: "92K", plays: "980K" },
      },
    ],
    // Set 3
    [
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Detroit, MI",
        name: "Urban Legend",
        rank: 9,
        slug: "urban-legend",
        stats: { followers: "134K", plays: "890K" },
        verified: true,
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Afrobeats",
        location: "Houston, TX",
        name: "Solar Beats",
        rank: 10,
        slug: "solar-beats",
        stats: { followers: "112K", plays: "850K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "Nashville, TN",
        name: "Crystal Voice",
        rank: 11,
        slug: "crystal-voice",
        stats: { followers: "156K", plays: "820K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Portland, OR",
        name: "Midnight Run",
        rank: 12,
        slug: "midnight-run",
        stats: { followers: "87K", plays: "780K" },
      },
    ],
    // Set 4
    [
      {
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Philadelphia, PA",
        name: "Soul Fire",
        rank: 13,
        slug: "soul-fire",
        stats: { followers: "143K", plays: "750K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Indie",
        location: "Denver, CO",
        name: "Echo Valley",
        rank: 14,
        slug: "echo-valley",
        stats: { followers: "98K", plays: "720K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "San Francisco, CA",
        name: "Prism Sound",
        rank: 15,
        slug: "prism-sound",
        stats: { followers: "105K", plays: "690K" },
        verified: true,
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "Phoenix, AZ",
        name: "Wild Heart",
        rank: 16,
        slug: "wild-heart",
        stats: { followers: "121K", plays: "660K" },
      },
    ],
    // Set 5
    [
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Memphis, TN",
        name: "Thunder Bass",
        rank: 17,
        slug: "thunder-bass",
        stats: { followers: "94K", plays: "640K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "New Orleans, LA",
        name: "Velvet Tone",
        rank: 18,
        slug: "velvet-tone",
        stats: { followers: "118K", plays: "610K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Las Vegas, NV",
        name: "Neon Lights",
        rank: 19,
        slug: "neon-lights",
        stats: { followers: "86K", plays: "590K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Oakland, CA",
        name: "Golden Era",
        rank: 20,
        slug: "golden-era",
        stats: { followers: "108K", plays: "570K" },
        verified: true,
      },
    ],
  ];

  const newArtistsData = [
    // Set 1
    [
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Brooklyn, NY",
        name: "Fresh Start",
        rank: 1,
        slug: "fresh-start",
        stats: { followers: "2.3K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Los Angeles, CA",
        name: "Rookie Beats",
        rank: 2,
        slug: "rookie-beats",
        stats: { followers: "1.8K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Atlanta, GA",
        name: "New Horizon",
        rank: 3,
        slug: "new-horizon",
        stats: { followers: "3.1K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "Nashville, TN",
        name: "First Verse",
        rank: 4,
        slug: "first-verse",
        stats: { followers: "4.5K" },
      },
    ],
    // Set 2-5 with similar structure...
    [
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Afrobeats",
        location: "Houston, TX",
        name: "Debut Sound",
        rank: 5,
        slug: "debut-sound",
        stats: { followers: "2.9K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Rock",
        location: "Seattle, WA",
        name: "Starting Line",
        rank: 6,
        slug: "starting-line",
        stats: { followers: "1.6K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Indie",
        location: "Portland, OR",
        name: "Intro Track",
        rank: 7,
        slug: "intro-track",
        stats: { followers: "2.2K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Miami, FL",
        name: "First Drop",
        rank: 8,
        slug: "first-drop",
        stats: { followers: "3.4K" },
      },
    ],
    [
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Chicago, IL",
        name: "Beginning Vibe",
        rank: 9,
        slug: "beginning-vibe",
        stats: { followers: "1.9K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Detroit, MI",
        name: "Fresh Flow",
        rank: 10,
        slug: "fresh-flow",
        stats: { followers: "2.7K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "San Diego, CA",
        name: "New Wave Sound",
        rank: 11,
        slug: "new-wave-sound",
        stats: { followers: "3.8K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Philadelphia, PA",
        name: "Day One",
        rank: 12,
        slug: "day-one",
        stats: { followers: "2.1K" },
      },
    ],
    [
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Austin, TX",
        name: "Origin Sound",
        rank: 13,
        slug: "origin-sound",
        stats: { followers: "1.5K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Afrobeats",
        location: "Phoenix, AZ",
        name: "Alpha Beat",
        rank: 14,
        slug: "alpha-beat",
        stats: { followers: "2.4K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Las Vegas, NV",
        name: "Pilot Track",
        rank: 15,
        slug: "pilot-track",
        stats: { followers: "1.7K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "Denver, CO",
        name: "Launch Pad",
        rank: 16,
        slug: "launch-pad",
        stats: { followers: "3.2K" },
      },
    ],
    [
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Dallas, TX",
        name: "Genesis Vibe",
        rank: 17,
        slug: "genesis-vibe",
        stats: { followers: "2.6K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "San Francisco, CA",
        name: "Kickstart",
        rank: 18,
        slug: "kickstart",
        stats: { followers: "1.4K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Indie",
        location: "Boston, MA",
        name: "Initiate",
        rank: 19,
        slug: "initiate",
        stats: { followers: "2.8K" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Charlotte, NC",
        name: "Premiere Sound",
        rank: 20,
        slug: "premiere-sound",
        stats: { followers: "3.6K" },
      },
    ],
  ];

  const topArtistsData = [
    // Set 1
    [
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Los Angeles, CA",
        name: "Cosmic Sound",
        rank: 1,
        slug: "cosmic-sound",
        stats: { battleWins: 12, followers: "312K", plays: "5.2M" },
        verified: true,
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "New York, NY",
        name: "Soul Sister",
        rank: 2,
        slug: "soul-sister",
        stats: { battleWins: 10, followers: "278K", plays: "4.8M" },
        verified: true,
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Atlanta, GA",
        name: "Beat Maker",
        rank: 3,
        slug: "beat-maker",
        stats: { battleWins: 15, followers: "445K", plays: "6.1M" },
        verified: true,
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "Nashville, TN",
        name: "Melody Queen",
        rank: 4,
        slug: "melody-queen",
        stats: { battleWins: 8, followers: "523K", plays: "7.3M" },
        verified: true,
      },
    ],
    // Set 2-5...
    [
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Afrobeats",
        location: "Houston, TX",
        name: "Rhythm King",
        rank: 5,
        slug: "rhythm-king",
        stats: { battleWins: 11, followers: "189K", plays: "3.9M" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Miami, FL",
        name: "Sound Wave",
        rank: 6,
        slug: "sound-wave",
        stats: { battleWins: 9, followers: "234K", plays: "4.2M" },
        verified: true,
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Chicago, IL",
        name: "Vibe Master",
        rank: 7,
        slug: "vibe-master",
        stats: { battleWins: 13, followers: "267K", plays: "3.7M" },
        verified: true,
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Detroit, MI",
        name: "Pulse Producer",
        rank: 8,
        slug: "pulse-producer",
        stats: { battleWins: 7, followers: "198K", plays: "3.5M" },
      },
    ],
    [
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "San Francisco, CA",
        name: "Frequency FX",
        rank: 9,
        slug: "frequency-fx",
        stats: { battleWins: 14, followers: "176K", plays: "3.3M" },
        verified: true,
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "Los Angeles, CA",
        name: "Vocal Legend",
        rank: 10,
        slug: "vocal-legend",
        stats: { battleWins: 6, followers: "389K", plays: "4.6M" },
        verified: true,
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Memphis, TN",
        name: "Trap Lord",
        rank: 11,
        slug: "trap-lord",
        stats: { battleWins: 16, followers: "245K", plays: "3.1M" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Philadelphia, PA",
        name: "Harmony Maker",
        rank: 12,
        slug: "harmony-maker",
        stats: { battleWins: 5, followers: "167K", plays: "2.9M" },
      },
    ],
    [
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Seattle, WA",
        name: "Synth Master",
        rank: 13,
        slug: "synth-master",
        stats: { battleWins: 10, followers: "154K", plays: "2.8M" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Oakland, CA",
        name: "Bass Champion",
        rank: 14,
        slug: "bass-champion",
        stats: { battleWins: 12, followers: "223K", plays: "3.4M" },
        verified: true,
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "New Orleans, LA",
        name: "Smooth Operator",
        rank: 15,
        slug: "smooth-operator",
        stats: { battleWins: 8, followers: "189K", plays: "2.6M" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "San Diego, CA",
        name: "Pop Icon",
        rank: 16,
        slug: "pop-icon",
        stats: { battleWins: 4, followers: "312K", plays: "4.1M" },
        verified: true,
      },
    ],
    [
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Dallas, TX",
        name: "Beat Wizard",
        rank: 17,
        slug: "beat-wizard",
        stats: { battleWins: 11, followers: "178K", plays: "2.5M" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "Phoenix, AZ",
        name: "Melody Smith",
        rank: 18,
        slug: "melody-smith",
        stats: { battleWins: 7, followers: "201K", plays: "2.7M" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Afrobeats",
        location: "Portland, OR",
        name: "Rhythm Pro",
        rank: 19,
        slug: "rhythm-pro",
        stats: { battleWins: 9, followers: "156K", plays: "2.4M" },
      },
      {
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Austin, TX",
        name: "Sound Architect",
        rank: 20,
        slug: "sound-architect",
        stats: { battleWins: 13, followers: "267K", plays: "3.2M" },
        verified: true,
      },
    ],
  ];

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      {/* Hero Section */}
      <section className="mb-8">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-balance">
          Discover Artists
        </h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-3xl text-pretty">
          Find the hottest new talent and established stars in your area.
          Support local artists and discover your next favorite sound.
        </p>
      </section>

      <BattleFilters
        regionType={regionType}
        region={region}
        genre={genre}
        sort={sort}
        onRegionTypeChange={setRegionType}
        onRegionChange={setRegion}
        onGenreChange={setGenre}
        onSortChange={setSort}
        sortOptions={sortOptions}
      />

      <div className="space-y-12">
        {/* Rising Stars Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <TrendingUp className="size-6 text-primary" />
                Rising Stars
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Artists on the rise with growing momentum
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {risingArtistsData.slice(0, 5).map((artists, groupIndex) => (
              <div key={groupIndex} className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 min-w-max pb-2">
                  {artists.map((artist) => (
                    <div key={artist.slug} className="w-64 flex-shrink-0">
                      <ArtistLeaderboardCard
                        artists={[artist]}
                        type="rising"
                        showBorder={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* New Artists Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <Sparkles className="size-6 text-primary" />
                New Artists
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Fresh talent joining the scene
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {newArtistsData.slice(0, 5).map((artists, groupIndex) => (
              <div key={groupIndex} className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 min-w-max pb-2">
                  {artists.map((artist) => (
                    <div key={artist.slug} className="w-64 flex-shrink-0">
                      <ArtistLeaderboardCard
                        artists={[artist]}
                        type="new"
                        showBorder={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Top Artists Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <Trophy className="size-6 text-primary" />
                Top Artists This Month
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                The most popular artists right now
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {topArtistsData.slice(0, 5).map((artists, groupIndex) => (
              <div key={groupIndex} className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 min-w-max pb-2">
                  {artists.map((artist) => (
                    <div key={artist.slug} className="w-64 flex-shrink-0">
                      <ArtistLeaderboardCard
                        artists={[artist]}
                        type="top"
                        showBorder={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
