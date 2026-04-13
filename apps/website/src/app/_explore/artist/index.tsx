import { useState, useEffect, useRef } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { TrendingUp, Sparkles, Trophy } from "lucide-react"
import { ArtistLeaderboardCard } from "@/components/explore/artist-leaderboard-card"
import { BattleFilters } from "@/components/explore/battle-filters"

const sortOptions = [
  { value: "rank-asc", label: "Rank (High to Low)" },
  { value: "rank-desc", label: "Rank (Low to High)" },
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
]

export const Route = createFileRoute('/_explore/artist/')({
  component: ArtistPage,
})

function ArtistPage() {
  const router = useRouter()
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "")
  const isInitialMount = useRef(true)

  const [regionType, setRegionType] = useState<"north-america" | "global">("north-america")
  const [region, setRegion] = useState("all")
  const [genre, setGenre] = useState("all")
  const [sort, setSort] = useState("rank-asc")

  // Initialize from URL params or localStorage
  useEffect(() => {
    const urlRegionType = searchParams.get("regionType") as "north-america" | "global" | null
    const urlRegion = searchParams.get("region")
    const urlGenre = searchParams.get("genre")
    const urlSort = searchParams.get("sort")

    if (urlRegionType || urlRegion || urlGenre || urlSort) {
      if (urlRegionType) setRegionType(urlRegionType)
      if (urlRegion) setRegion(urlRegion)
      if (urlGenre) setGenre(urlGenre)
      if (urlSort) setSort(urlSort)
    } else {
      const savedRegionType = localStorage.getItem("exploreRegionType") as "north-america" | "global" | null
      const savedRegion = localStorage.getItem("exploreRegion")
      if (savedRegionType) setRegionType(savedRegionType)
      if (savedRegion) setRegion(savedRegion)
    }
  }, [searchParams])

  // Update URL and localStorage on filter changes (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const params = new URLSearchParams()
    params.set("regionType", regionType)
    params.set("region", region)
    params.set("genre", genre)
    params.set("sort", sort)

    
    localStorage.setItem("exploreRegionType", regionType)
    localStorage.setItem("exploreRegion", region)
  }, [regionType, region, genre, sort, router])

  const genres = ["All", "Hip-Hop", "R&B", "Pop", "Electronic", "Afrobeats", "Rock", "Jazz"]

  const risingArtistsData = [
    // Set 1
    [
      {
        rank: 1,
        slug: "luna-eclipse",
        name: "Luna Eclipse",
        avatar: "/diverse-user-avatars.png",
        genre: "R&B/Soul",
        location: "Los Angeles, CA",
        stats: { plays: "2.3M", followers: "124K" },
        verified: true,
      },
      {
        rank: 2,
        slug: "neon-pulse",
        name: "Neon Pulse",
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Miami, FL",
        stats: { plays: "1.9M", followers: "89K" },
      },
      {
        rank: 3,
        slug: "street-poet",
        name: "Street Poet",
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Atlanta, GA",
        stats: { plays: "1.7M", followers: "256K" },
        verified: true,
      },
      {
        rank: 4,
        slug: "voltage-dreams",
        name: "Voltage Dreams",
        avatar: "/diverse-user-avatars.png",
        genre: "Synthwave",
        location: "Austin, TX",
        stats: { plays: "1.5M", followers: "67K" },
      },
    ],
    // Set 2
    [
      {
        rank: 5,
        slug: "metro-flow",
        name: "Metro Flow",
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "New York, NY",
        stats: { plays: "1.4M", followers: "198K" },
        verified: true,
      },
      {
        rank: 6,
        slug: "ocean-drive",
        name: "Ocean Drive",
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "San Diego, CA",
        stats: { plays: "1.2M", followers: "145K" },
      },
      {
        rank: 7,
        slug: "rhythm-soul",
        name: "Rhythm Soul",
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Chicago, IL",
        stats: { plays: "1.1M", followers: "178K" },
      },
      {
        rank: 8,
        slug: "bass-wave",
        name: "Bass Wave",
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Seattle, WA",
        stats: { plays: "980K", followers: "92K" },
      },
    ],
    // Set 3
    [
      {
        rank: 9,
        slug: "urban-legend",
        name: "Urban Legend",
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Detroit, MI",
        stats: { plays: "890K", followers: "134K" },
        verified: true,
      },
      {
        rank: 10,
        slug: "solar-beats",
        name: "Solar Beats",
        avatar: "/diverse-user-avatars.png",
        genre: "Afrobeats",
        location: "Houston, TX",
        stats: { plays: "850K", followers: "112K" },
      },
      {
        rank: 11,
        slug: "crystal-voice",
        name: "Crystal Voice",
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "Nashville, TN",
        stats: { plays: "820K", followers: "156K" },
      },
      {
        rank: 12,
        slug: "midnight-run",
        name: "Midnight Run",
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Portland, OR",
        stats: { plays: "780K", followers: "87K" },
      },
    ],
    // Set 4
    [
      {
        rank: 13,
        slug: "soul-fire",
        name: "Soul Fire",
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Philadelphia, PA",
        stats: { plays: "750K", followers: "143K" },
      },
      {
        rank: 14,
        slug: "echo-valley",
        name: "Echo Valley",
        avatar: "/diverse-user-avatars.png",
        genre: "Indie",
        location: "Denver, CO",
        stats: { plays: "720K", followers: "98K" },
      },
      {
        rank: 15,
        slug: "prism-sound",
        name: "Prism Sound",
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "San Francisco, CA",
        stats: { plays: "690K", followers: "105K" },
        verified: true,
      },
      {
        rank: 16,
        slug: "wild-heart",
        name: "Wild Heart",
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "Phoenix, AZ",
        stats: { plays: "660K", followers: "121K" },
      },
    ],
    // Set 5
    [
      {
        rank: 17,
        slug: "thunder-bass",
        name: "Thunder Bass",
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Memphis, TN",
        stats: { plays: "640K", followers: "94K" },
      },
      {
        rank: 18,
        slug: "velvet-tone",
        name: "Velvet Tone",
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "New Orleans, LA",
        stats: { plays: "610K", followers: "118K" },
      },
      {
        rank: 19,
        slug: "neon-lights",
        name: "Neon Lights",
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Las Vegas, NV",
        stats: { plays: "590K", followers: "86K" },
      },
      {
        rank: 20,
        slug: "golden-era",
        name: "Golden Era",
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Oakland, CA",
        stats: { plays: "570K", followers: "108K" },
        verified: true,
      },
    ],
  ]

  const newArtistsData = [
    // Set 1
    [
      {
        rank: 1,
        slug: "fresh-start",
        name: "Fresh Start",
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Brooklyn, NY",
        stats: { followers: "2.3K" },
      },
      {
        rank: 2,
        slug: "rookie-beats",
        name: "Rookie Beats",
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Los Angeles, CA",
        stats: { followers: "1.8K" },
      },
      {
        rank: 3,
        slug: "new-horizon",
        name: "New Horizon",
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Atlanta, GA",
        stats: { followers: "3.1K" },
      },
      {
        rank: 4,
        slug: "first-verse",
        name: "First Verse",
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "Nashville, TN",
        stats: { followers: "4.5K" },
      },
    ],
    // Set 2-5 with similar structure...
    [
      {
        rank: 5,
        slug: "debut-sound",
        name: "Debut Sound",
        avatar: "/diverse-user-avatars.png",
        genre: "Afrobeats",
        location: "Houston, TX",
        stats: { followers: "2.9K" },
      },
      {
        rank: 6,
        slug: "starting-line",
        name: "Starting Line",
        avatar: "/diverse-user-avatars.png",
        genre: "Rock",
        location: "Seattle, WA",
        stats: { followers: "1.6K" },
      },
      {
        rank: 7,
        slug: "intro-track",
        name: "Intro Track",
        avatar: "/diverse-user-avatars.png",
        genre: "Indie",
        location: "Portland, OR",
        stats: { followers: "2.2K" },
      },
      {
        rank: 8,
        slug: "first-drop",
        name: "First Drop",
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Miami, FL",
        stats: { followers: "3.4K" },
      },
    ],
    [
      {
        rank: 9,
        slug: "beginning-vibe",
        name: "Beginning Vibe",
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Chicago, IL",
        stats: { followers: "1.9K" },
      },
      {
        rank: 10,
        slug: "fresh-flow",
        name: "Fresh Flow",
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Detroit, MI",
        stats: { followers: "2.7K" },
      },
      {
        rank: 11,
        slug: "new-wave-sound",
        name: "New Wave Sound",
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "San Diego, CA",
        stats: { followers: "3.8K" },
      },
      {
        rank: 12,
        slug: "day-one",
        name: "Day One",
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Philadelphia, PA",
        stats: { followers: "2.1K" },
      },
    ],
    [
      {
        rank: 13,
        slug: "origin-sound",
        name: "Origin Sound",
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Austin, TX",
        stats: { followers: "1.5K" },
      },
      {
        rank: 14,
        slug: "alpha-beat",
        name: "Alpha Beat",
        avatar: "/diverse-user-avatars.png",
        genre: "Afrobeats",
        location: "Phoenix, AZ",
        stats: { followers: "2.4K" },
      },
      {
        rank: 15,
        slug: "pilot-track",
        name: "Pilot Track",
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Las Vegas, NV",
        stats: { followers: "1.7K" },
      },
      {
        rank: 16,
        slug: "launch-pad",
        name: "Launch Pad",
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "Denver, CO",
        stats: { followers: "3.2K" },
      },
    ],
    [
      {
        rank: 17,
        slug: "genesis-vibe",
        name: "Genesis Vibe",
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Dallas, TX",
        stats: { followers: "2.6K" },
      },
      {
        rank: 18,
        slug: "kickstart",
        name: "Kickstart",
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "San Francisco, CA",
        stats: { followers: "1.4K" },
      },
      {
        rank: 19,
        slug: "initiate",
        name: "Initiate",
        avatar: "/diverse-user-avatars.png",
        genre: "Indie",
        location: "Boston, MA",
        stats: { followers: "2.8K" },
      },
      {
        rank: 20,
        slug: "premiere-sound",
        name: "Premiere Sound",
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Charlotte, NC",
        stats: { followers: "3.6K" },
      },
    ],
  ]

  const topArtistsData = [
    // Set 1
    [
      {
        rank: 1,
        slug: "cosmic-sound",
        name: "Cosmic Sound",
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Los Angeles, CA",
        stats: { plays: "5.2M", followers: "312K", battleWins: 12 },
        verified: true,
      },
      {
        rank: 2,
        slug: "soul-sister",
        name: "Soul Sister",
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "New York, NY",
        stats: { plays: "4.8M", followers: "278K", battleWins: 10 },
        verified: true,
      },
      {
        rank: 3,
        slug: "beat-maker",
        name: "Beat Maker",
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Atlanta, GA",
        stats: { plays: "6.1M", followers: "445K", battleWins: 15 },
        verified: true,
      },
      {
        rank: 4,
        slug: "melody-queen",
        name: "Melody Queen",
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "Nashville, TN",
        stats: { plays: "7.3M", followers: "523K", battleWins: 8 },
        verified: true,
      },
    ],
    // Set 2-5...
    [
      {
        rank: 5,
        slug: "rhythm-king",
        name: "Rhythm King",
        avatar: "/diverse-user-avatars.png",
        genre: "Afrobeats",
        location: "Houston, TX",
        stats: { plays: "3.9M", followers: "189K", battleWins: 11 },
      },
      {
        rank: 6,
        slug: "sound-wave",
        name: "Sound Wave",
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Miami, FL",
        stats: { plays: "4.2M", followers: "234K", battleWins: 9 },
        verified: true,
      },
      {
        rank: 7,
        slug: "vibe-master",
        name: "Vibe Master",
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Chicago, IL",
        stats: { plays: "3.7M", followers: "267K", battleWins: 13 },
        verified: true,
      },
      {
        rank: 8,
        slug: "pulse-producer",
        name: "Pulse Producer",
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Detroit, MI",
        stats: { plays: "3.5M", followers: "198K", battleWins: 7 },
      },
    ],
    [
      {
        rank: 9,
        slug: "frequency-fx",
        name: "Frequency FX",
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "San Francisco, CA",
        stats: { plays: "3.3M", followers: "176K", battleWins: 14 },
        verified: true,
      },
      {
        rank: 10,
        slug: "vocal-legend",
        name: "Vocal Legend",
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "Los Angeles, CA",
        stats: { plays: "4.6M", followers: "389K", battleWins: 6 },
        verified: true,
      },
      {
        rank: 11,
        slug: "trap-lord",
        name: "Trap Lord",
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Memphis, TN",
        stats: { plays: "3.1M", followers: "245K", battleWins: 16 },
      },
      {
        rank: 12,
        slug: "harmony-maker",
        name: "Harmony Maker",
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "Philadelphia, PA",
        stats: { plays: "2.9M", followers: "167K", battleWins: 5 },
      },
    ],
    [
      {
        rank: 13,
        slug: "synth-master",
        name: "Synth Master",
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Seattle, WA",
        stats: { plays: "2.8M", followers: "154K", battleWins: 10 },
      },
      {
        rank: 14,
        slug: "bass-champion",
        name: "Bass Champion",
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Oakland, CA",
        stats: { plays: "3.4M", followers: "223K", battleWins: 12 },
        verified: true,
      },
      {
        rank: 15,
        slug: "smooth-operator",
        name: "Smooth Operator",
        avatar: "/diverse-user-avatars.png",
        genre: "R&B",
        location: "New Orleans, LA",
        stats: { plays: "2.6M", followers: "189K", battleWins: 8 },
      },
      {
        rank: 16,
        slug: "pop-icon",
        name: "Pop Icon",
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "San Diego, CA",
        stats: { plays: "4.1M", followers: "312K", battleWins: 4 },
        verified: true,
      },
    ],
    [
      {
        rank: 17,
        slug: "beat-wizard",
        name: "Beat Wizard",
        avatar: "/diverse-user-avatars.png",
        genre: "Hip-Hop",
        location: "Dallas, TX",
        stats: { plays: "2.5M", followers: "178K", battleWins: 11 },
      },
      {
        rank: 18,
        slug: "melody-smith",
        name: "Melody Smith",
        avatar: "/diverse-user-avatars.png",
        genre: "Pop",
        location: "Phoenix, AZ",
        stats: { plays: "2.7M", followers: "201K", battleWins: 7 },
      },
      {
        rank: 19,
        slug: "rhythm-pro",
        name: "Rhythm Pro",
        avatar: "/diverse-user-avatars.png",
        genre: "Afrobeats",
        location: "Portland, OR",
        stats: { plays: "2.4M", followers: "156K", battleWins: 9 },
      },
      {
        rank: 20,
        slug: "sound-architect",
        name: "Sound Architect",
        avatar: "/diverse-user-avatars.png",
        genre: "Electronic",
        location: "Austin, TX",
        stats: { plays: "3.2M", followers: "267K", battleWins: 13 },
        verified: true,
      },
    ],
  ]

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      {/* Hero Section */}
      <section className="mb-8">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-balance">Discover Artists</h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-3xl text-pretty">
          Find the hottest new talent and established stars in your area. Support local artists and discover your next
          favorite sound.
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
              <p className="text-sm text-muted-foreground mt-1">Artists on the rise with growing momentum</p>
            </div>
          </div>

          <div className="space-y-2">
            {risingArtistsData.slice(0, 5).map((artists, groupIndex) => (
              <div key={groupIndex} className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 min-w-max pb-2">
                  {artists.map((artist) => (
                    <div key={artist.slug} className="w-64 flex-shrink-0">
                      <ArtistLeaderboardCard artists={[artist]} type="rising" showBorder={false} />
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
              <p className="text-sm text-muted-foreground mt-1">Fresh talent joining the scene</p>
            </div>
          </div>

          <div className="space-y-2">
            {newArtistsData.slice(0, 5).map((artists, groupIndex) => (
              <div key={groupIndex} className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 min-w-max pb-2">
                  {artists.map((artist) => (
                    <div key={artist.slug} className="w-64 flex-shrink-0">
                      <ArtistLeaderboardCard artists={[artist]} type="new" showBorder={false} />
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
              <p className="text-sm text-muted-foreground mt-1">The most popular artists right now</p>
            </div>
          </div>

          <div className="space-y-2">
            {topArtistsData.slice(0, 5).map((artists, groupIndex) => (
              <div key={groupIndex} className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 min-w-max pb-2">
                  {artists.map((artist) => (
                    <div key={artist.slug} className="w-64 flex-shrink-0">
                      <ArtistLeaderboardCard artists={[artist]} type="top" showBorder={false} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
