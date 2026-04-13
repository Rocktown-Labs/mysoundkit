
import { useEffect, useState, useRef } from "react"
import { useRouter, useRouterState } from "@tanstack/react-router"
import { BattleFilters } from "./battle-filters"
import { BattleCard } from "./battle-card"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Trophy, TrendingUp, Music2 } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type BattleType = "live" | "leaderboard" | "must-see" | "upcoming"

interface BattleViewAllProps {
  type: BattleType
  title: string
  description: string
}

const sortOptionsMap = {
  live: [
    { value: "viewers-desc", label: "Most Viewers" },
    { value: "viewers-asc", label: "Least Viewers" },
    { value: "time-asc", label: "Started First" },
    { value: "time-desc", label: "Started Last" },
  ],
  leaderboard: [
    { value: "rank-asc", label: "Rank: 1 to 100" },
    { value: "rank-desc", label: "Rank: 100 to 1" },
    { value: "wins-desc", label: "Most Wins" },
    { value: "win-rate-desc", label: "Highest Win Rate" },
  ],
  "must-see": [
    { value: "views-desc", label: "Most Viewed" },
    { value: "views-asc", label: "Least Viewed" },
    { value: "date-desc", label: "Most Recent" },
    { value: "date-asc", label: "Oldest" },
  ],
  upcoming: [
    { value: "time-asc", label: "Soonest First" },
    { value: "time-desc", label: "Latest First" },
    { value: "hype-desc", label: "Most Anticipated" },
  ],
}

const generateLiveBattles = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `live-${i}`,
    status: Math.random() > 0.5 ? ("round" as const) : ("voting" as const),
    currentRound: Math.floor(Math.random() * 3) + 1,
    totalRounds: 3,
    timeLeft: Math.floor(Math.random() * 180) + 60,
    artist1: `Artist ${i * 2 + 1}`,
    artist1Image: `/placeholder.svg?height=100&width=100&query=artist${i * 2 + 1}`,
    artist2: `Artist ${i * 2 + 2}`,
    artist2Image: `/placeholder.svg?height=100&width=100&query=artist${i * 2 + 2}`,
    genre: ["Hip-Hop", "R&B/Soul", "Electronic", "Pop"][Math.floor(Math.random() * 4)],
    viewers: Math.floor(Math.random() * 10000) + 100,
    location: "New York, US",
  }))

const generateLeaderboardArtists = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    rank: i + 1,
    artist: `Artist ${i + 1}`,
    avatar: `/placeholder.svg?height=80&width=80&query=artist${i + 1}`,
    wins: Math.floor(Math.random() * 50) + 10,
    losses: Math.floor(Math.random() * 20),
    winRate: Math.floor(Math.random() * 40) + 60,
    genre: ["Hip-Hop", "R&B/Soul", "Electronic", "Pop"][Math.floor(Math.random() * 4)],
    location: "California, US",
  }))

const generateMustSeeBattles = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `past-${i}`,
    artist1: `Artist ${i * 2 + 1}`,
    artist1Image: `/placeholder.svg?height=100&width=100&query=artist${i * 2 + 1}`,
    artist2: `Artist ${i * 2 + 2}`,
    artist2Image: `/placeholder.svg?height=100&width=100&query=artist${i * 2 + 2}`,
    winner: Math.random() > 0.5 ? "artist1" : "artist2",
    views: Math.floor(Math.random() * 100000) + 1000,
    genre: ["Hip-Hop", "R&B/Soul", "Electronic", "Pop"][Math.floor(Math.random() * 4)],
    date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    location: "Texas, US",
  }))

const generateUpcomingBattles = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `upcoming-${i}`,
    artist1: `Artist ${i * 2 + 1}`,
    artist1Image: `/placeholder.svg?height=100&width=100&query=artist${i * 2 + 1}`,
    artist1Stats: {
      wins: Math.floor(Math.random() * 30) + 5,
      losses: Math.floor(Math.random() * 15),
      winRate: Math.floor(Math.random() * 40) + 50,
      topSongs: ["Track A", "Track B", "Track C"],
    },
    artist2: `Artist ${i * 2 + 2}`,
    artist2Image: `/placeholder.svg?height=100&width=100&query=artist${i * 2 + 2}`,
    artist2Stats: {
      wins: Math.floor(Math.random() * 30) + 5,
      losses: Math.floor(Math.random() * 15),
      winRate: Math.floor(Math.random() * 40) + 50,
      topSongs: ["Track X", "Track Y", "Track Z"],
    },
    scheduledTime: new Date(Date.now() + Math.random() * 24 * 60 * 60 * 1000).toISOString(),
    genre: ["Hip-Hop", "R&B/Soul", "Electronic", "Pop"][Math.floor(Math.random() * 4)],
    anticipation: Math.floor(Math.random() * 5000) + 100,
    location: "Florida, US",
  }))

export function BattleViewAll({ type, title, description }: BattleViewAllProps) {
  const router = useRouter()
  const locationSearch = useRouterState({ select: (s) => s.location.search })
  const searchParams = new URLSearchParams(
    typeof locationSearch === 'string' ? locationSearch : ''
  )
  const [selectedMatchup, setSelectedMatchup] = useState<any>(null)
  const isInitialMount = useRef(true)

  const [regionType, setRegionType] = useState<"north-america" | "global">(() => {
    if (searchParams.get("regionType")) {
      return searchParams.get("regionType") as "north-america" | "global"
    }
    const saved = localStorage.getItem("battleFilters")
    if (saved) {
      return (JSON.parse(saved).regionType as "north-america" | "global") || "north-america"
    }
    return "north-america"
  })

  const [region, setRegion] = useState(() => {
    if (searchParams.get("region")) return searchParams.get("region") || "all"
    const saved = localStorage.getItem("battleFilters")
    return saved ? JSON.parse(saved).region || "all" : "all"
  })

  const [genre, setGenre] = useState(() => {
    if (searchParams.get("genre")) return searchParams.get("genre") || "all"
    const saved = localStorage.getItem("battleFilters")
    return saved ? JSON.parse(saved).genre || "all" : "all"
  })

  const [sort, setSort] = useState(() => {
    if (searchParams.get("sort")) return searchParams.get("sort") || sortOptionsMap[type][0].value
    const saved = localStorage.getItem("battleFilters")
    return saved ? JSON.parse(saved).sort || sortOptionsMap[type][0].value : sortOptionsMap[type][0].value
  })

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
    router.navigate({ search: { regionType, region, genre, sort }, replace: true })

    localStorage.setItem("battleFilters", JSON.stringify({ regionType, region, genre, sort }))
  }, [regionType, region, genre, sort, router])

  const data =
    type === "live"
      ? generateLiveBattles(50)
      : type === "leaderboard"
        ? generateLeaderboardArtists(100)
        : type === "must-see"
          ? generateMustSeeBattles(50)
          : generateUpcomingBattles(30)

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link to="/battles">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">{title}</h1>
          <p className="text-muted-foreground text-sm md:text-base mt-1">{description}</p>
        </div>
      </div>

      {/* Filters */}
      <BattleFilters
        regionType={regionType}
        region={region}
        genre={genre}
        sort={sort}
        onRegionTypeChange={setRegionType}
        onRegionChange={setRegion}
        onGenreChange={setGenre}
        onSortChange={setSort}
        sortOptions={sortOptionsMap[type]}
      />

      {/* Content based on type */}
      {type === "live" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data as ReturnType<typeof generateLiveBattles>).map((battle) => (
            <BattleCard key={battle.id} {...battle} />
          ))}
        </div>
      )}

      {type === "leaderboard" && (
        <div className="space-y-2">
          {(data as ReturnType<typeof generateLeaderboardArtists>).map((artist) => (
            <Card key={artist.rank} className="hover:bg-accent transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="text-2xl font-bold text-muted-foreground w-12 text-center">{artist.rank}</div>
                <Avatar className="size-12">
                  <AvatarImage src={artist.avatar || "/placeholder.svg"} alt={artist.artist} />
                  <AvatarFallback>{artist.artist[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{artist.artist}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{artist.genre}</span>
                    <span>•</span>
                    <span>{artist.location}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="font-semibold">{artist.wins}</div>
                    <div className="text-muted-foreground text-xs">Wins</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">{artist.losses}</div>
                    <div className="text-muted-foreground text-xs">Losses</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-primary">{artist.winRate}%</div>
                    <div className="text-muted-foreground text-xs">Win Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {type === "must-see" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data as ReturnType<typeof generateMustSeeBattles>).map((battle) => (
            <Link key={battle.id} to={`/battles/${battle.id}`}>
              <Card className="group hover:bg-accent transition-colors cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="secondary">{battle.genre}</Badge>
                    <div className="text-sm text-muted-foreground">{battle.views.toLocaleString()} views</div>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar className="size-12">
                      <AvatarImage src={battle.artist1Image || "/placeholder.svg"} alt={battle.artist1} />
                      <AvatarFallback>{battle.artist1[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{battle.artist1}</h3>
                      {battle.winner === "artist1" && (
                        <Badge variant="default" className="text-xs mt-1">
                          <Trophy className="size-3 mr-1" />
                          Winner
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-center text-xs text-muted-foreground my-2">VS</div>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-12">
                      <AvatarImage src={battle.artist2Image || "/placeholder.svg"} alt={battle.artist2} />
                      <AvatarFallback>{battle.artist2[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{battle.artist2}</h3>
                      {battle.winner === "artist2" && (
                        <Badge variant="default" className="text-xs mt-1">
                          <Trophy className="size-3 mr-1" />
                          Winner
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                    {new Date(battle.date).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {type === "upcoming" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data as ReturnType<typeof generateUpcomingBattles>).map((battle) => (
              <Card key={battle.id} className="group hover:bg-accent transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="secondary">{battle.genre}</Badge>
                    <div className="text-sm text-muted-foreground">
                      {new Date(battle.scheduledTime).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar className="size-12">
                      <AvatarImage src={battle.artist1Image || "/placeholder.svg"} alt={battle.artist1} />
                      <AvatarFallback>{battle.artist1[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{battle.artist1}</h3>
                    </div>
                  </div>
                  <div className="text-center text-xs text-muted-foreground my-2">VS</div>
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="size-12">
                      <AvatarImage src={battle.artist2Image || "/placeholder.svg"} alt={battle.artist2} />
                      <AvatarFallback>{battle.artist2[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{battle.artist2}</h3>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                      Join Queue
                    </Button>
                    <Button variant="default" size="sm" className="flex-1" onClick={() => setSelectedMatchup(battle)}>
                      View Matchup
                    </Button>
                  </div>
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="size-3" />
                    {battle.anticipation.toLocaleString()} interested
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Head to Head Matchup Dialog */}
          <Dialog open={!!selectedMatchup} onOpenChange={() => setSelectedMatchup(null)}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Head to Head Matchup</DialogTitle>
                <DialogDescription>Compare artist stats and performance</DialogDescription>
              </DialogHeader>
              {selectedMatchup && (
                <div className="space-y-6">
                  {/* Artist Headers */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center text-center">
                      <Avatar className="size-20 mb-2">
                        <AvatarImage
                          src={selectedMatchup.artist1Image || "/placeholder.svg"}
                          alt={selectedMatchup.artist1}
                        />
                        <AvatarFallback>{selectedMatchup.artist1[0]}</AvatarFallback>
                      </Avatar>
                      <h3 className="font-bold text-lg">{selectedMatchup.artist1}</h3>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <Avatar className="size-20 mb-2">
                        <AvatarImage
                          src={selectedMatchup.artist2Image || "/placeholder.svg"}
                          alt={selectedMatchup.artist2}
                        />
                        <AvatarFallback>{selectedMatchup.artist2[0]}</AvatarFallback>
                      </Avatar>
                      <h3 className="font-bold text-lg">{selectedMatchup.artist2}</h3>
                    </div>
                  </div>

                  {/* Stats Comparison */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-right font-semibold">{selectedMatchup.artist1Stats.wins}</div>
                      <div className="text-center text-sm text-muted-foreground">Total Wins</div>
                      <div className="text-left font-semibold">{selectedMatchup.artist2Stats.wins}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-right font-semibold">{selectedMatchup.artist1Stats.losses}</div>
                      <div className="text-center text-sm text-muted-foreground">Total Losses</div>
                      <div className="text-left font-semibold">{selectedMatchup.artist2Stats.losses}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-right font-semibold text-primary">
                        {selectedMatchup.artist1Stats.winRate}%
                      </div>
                      <div className="text-center text-sm text-muted-foreground">Win Rate</div>
                      <div className="text-left font-semibold text-primary">
                        {selectedMatchup.artist2Stats.winRate}%
                      </div>
                    </div>
                  </div>

                  {/* Top Songs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Music2 className="size-4" />
                        Top Songs
                      </h4>
                      <ul className="space-y-1 text-sm">
                        {selectedMatchup.artist1Stats.topSongs.map((song: string, i: number) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="text-muted-foreground">{i + 1}.</span>
                            {song}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Music2 className="size-4" />
                        Top Songs
                      </h4>
                      <ul className="space-y-1 text-sm">
                        {selectedMatchup.artist2Stats.topSongs.map((song: string, i: number) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="text-muted-foreground">{i + 1}.</span>
                            {song}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
