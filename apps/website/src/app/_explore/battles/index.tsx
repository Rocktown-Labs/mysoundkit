import { useState, useEffect } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Play, Trophy, Calendar, Zap, Eye, Clock, Bell, Users, Music } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AppImage } from "@/components/ui/app-image"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BattleCard } from "@/components/explore/battle-card"
import { SectionHeader } from "@/components/explore/section-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export const Route = createFileRoute('/_explore/battles/')({
  component: BattlesPage,
})

function BattlesPage() {
  const [selectedLocation, setSelectedLocation] = useState("California")
  const [viewMode, setViewMode] = useState<"usa" | "global">("usa")
  const [selectedState, setSelectedState] = useState("USA")

  const usStates = [
    "USA", // Show all USA first
    "Alabama",
    "Alaska",
    "Arizona",
    "Arkansas",
    "California",
    "Colorado",
    "Connecticut",
    "Delaware",
    "Florida",
    "Georgia",
    "Hawaii",
    "Idaho",
    "Illinois",
    "Indiana",
    "Iowa",
    "Kansas",
    "Kentucky",
    "Louisiana",
    "Maine",
    "Maryland",
    "Massachusetts",
    "Michigan",
    "Minnesota",
    "Mississippi",
    "Missouri",
    "Montana",
    "Nebraska",
    "Nevada",
    "New Hampshire",
    "New Jersey",
    "New Mexico",
    "New York",
    "North Carolina",
    "North Dakota",
    "Ohio",
    "Oklahoma",
    "Oregon",
    "Pennsylvania",
    "Rhode Island",
    "South Carolina",
    "South Dakota",
    "Tennessee",
    "Texas",
    "Utah",
    "Vermont",
    "Virginia",
    "Washington",
    "West Virginia",
    "Wisconsin",
    "Wyoming",
  ]

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
            )
            const data = await response.json()
            if (data.principalSubdivision) {
              setSelectedState(data.principalSubdivision)
              setSelectedLocation(data.principalSubdivision)
            }
          } catch (error) {
            console.error("Error getting location:", error)
          }
        },
        (error) => {
          console.error("Geolocation error:", error)
        },
      )
    }
  }, [])

  return (
    <section className="min-h-screen bg-background pb-20 md:pb-8">
      <section className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
        {/* Hero CTA */}
        <section className="mb-6 md:mb-8">
          <div className="relative overflow-hidden rounded-xl border">
            <div className="absolute inset-0">
              <AppImage
                src="/images/excited-audience-watching-confetti-fireworks-having-fun-music-festival-night-copy-space.jpg"
                alt="Concert crowd with confetti and fireworks"
                width={1600}
                height={900}
                layout="fullWidth"
                className="w-full h-full object-cover object-center"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/70 to-background/90" />
            <div className="relative px-4 sm:px-6 md:px-12 py-8 sm:py-12 md:py-16 lg:py-20 text-center min-h-[280px] sm:min-h-[320px] md:min-h-[400px] flex flex-col items-center justify-center">
              <Badge className="mb-2 md:mb-4" variant="secondary">
                <Zap className="size-3 mr-1" />
                Live Battles
              </Badge>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-2 sm:mb-3 md:mb-6 text-white leading-tight">
                Vote on Live Music Battles
              </h1>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/95 max-w-2xl mx-auto mb-4 sm:mb-6 md:mb-8 px-2 leading-relaxed">
                Watch artists compete in real-time. Cast your vote and help decide who wins.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 justify-center px-2 w-full max-w-md mx-auto sm:max-w-none">
                <Link to="#watch-now" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-12 md:h-14 hover:text-white"
                  >
                    <Play className="size-4 sm:size-5 mr-2" />
                    Watch Live Battles
                  </Button>
                </Link>
                <Link to="/dashboard/battles/create" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto bg-black text-white border-white/20 hover:bg-black hover:text-primary text-sm sm:text-base h-10 sm:h-12 md:h-14"
                  >
                    <Trophy className="size-4 sm:size-5 mr-2" />
                    Start Your Battle
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Watch Now Section */}
        <section id="watch-now" className="mb-6 md:mb-8">
          <SectionHeader
            title="Watch Now"
            description={
              selectedLocation === "global" ? "Live battles worldwide" : `Live battles in ${selectedLocation}`
            }
            icon={<Play className="size-6 text-primary" />}
            viewAllHref={`/battles/live?location=${selectedLocation}`}
          />

          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
            <div className="flex gap-3 md:gap-4 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-w-max md:min-w-0">
              <BattleCard
                id="battle-1"
                title="West Coast Showdown"
                track1={{
                  title: "Midnight Drive",
                  artist: "DJ Nova",
                  votes: 1247,
                  cover: "/summer-music-album-cover.png",
                }}
                track2={{
                  title: "City Lights",
                  artist: "MC Rhythm",
                  votes: 1089,
                  cover: "/night-music-album-cover.png",
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
                  title: "Golden Hour",
                  artist: "Sunset Collective",
                  votes: 892,
                  cover: "/hip-hop-album-cover.png",
                }}
                track2={{
                  title: "Neon Nights",
                  artist: "Urban Echo",
                  votes: 756,
                  cover: "/summer-music-album-cover.png",
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
                  title: "Bassline Theory",
                  artist: "Sub Frequency",
                  votes: 2156,
                  cover: "/night-music-album-cover.png",
                }}
                track2={{
                  title: "Rhythm Code",
                  artist: "Beat Architect",
                  votes: 1998,
                  cover: "/hip-hop-album-cover.png",
                }}
                endsIn="1h 05m"
                genre="Electronic"
                isLive={true}
                currentRound={3}
                totalRounds={3}
                isVoting={false}
                queueSize={8}
              />
              <BattleCard
                id="battle-4"
                title="San Diego Sessions"
                track1={{
                  title: "Coastal Vibes",
                  artist: "Wave Rider",
                  votes: 634,
                  cover: "/summer-music-album-cover.png",
                }}
                track2={{
                  title: "Sunset Strip",
                  artist: "Pacific Sound",
                  votes: 578,
                  cover: "/night-music-album-cover.png",
                }}
                endsIn="3h 45m"
                genre="Pop"
                isLive={true}
                currentRound={1}
                totalRounds={3}
                isVoting={false}
                queueSize={23}
              />
            </div>
          </div>
        </section>

        {/* Battle Leaderboard */}
        <section className="mb-6 md:mb-8">
          <SectionHeader
            title="Battle Leaderboard"
            description="Top artists in the battle scene"
            icon={<Trophy className="size-6 text-primary" />}
            viewAllHref="/battles/leaderboard"
          />

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <Select
              value={viewMode === "usa" ? selectedState : ""}
              onValueChange={(value) => {
                setViewMode("usa")
                setSelectedState(value)
                setSelectedLocation(value)
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
                setViewMode("global")
                setSelectedLocation(value)
              }}
              disabled={viewMode === "usa"}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select global region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">🌍 All Global</SelectItem>
                <SelectItem value="africa">🌍 Africa</SelectItem>
                <SelectItem value="asia">🌏 Asia</SelectItem>
                <SelectItem value="europe">🌍 Europe</SelectItem>
                <SelectItem value="south-america">🌎 South America</SelectItem>
                <SelectItem value="australia">🌏 Australia & Oceania</SelectItem>
                <SelectItem value="antarctica">🌍 Antarctica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scrollable leaderboard cards - showing top 20 in sets of 4 */}
          <div className="overflow-x-auto pb-4 scrollbar-hide">
            <div className="flex gap-4 md:gap-6">
              {/* Card 1: Ranks 1-4 */}
              <div className="shrink-0 w-[85vw] md:w-[400px] space-y-3">
                {[
                  { rank: 1, name: "DJ Nova", wins: 47, battles: 52, flag: "🇺🇸", city: "Los Angeles, CA" },
                  { rank: 2, name: "MC Rhythm", wins: 42, battles: 50, flag: "🇺🇸", city: "Brooklyn, NY" },
                  { rank: 3, name: "Luna Eclipse", wins: 38, battles: 45, flag: "🇺🇸", city: "Atlanta, GA" },
                  { rank: 4, name: "Street Poet", wins: 35, battles: 44, flag: "🇺🇸", city: "Houston, TX" },
                ].map((artist) => (
                  <Link key={artist.rank}
                    to={`/artist/${artist.name.toLowerCase().replace(" ", "-")}`}
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
                      <div className="font-semibold text-sm truncate">{artist.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{artist.city}</div>
                    </div>
                    <div className="text-xl shrink-0">{artist.flag}</div>
                  </Link>
                ))}
              </div>

              {/* Card 2: Ranks 5-8 */}
              <div className="shrink-0 w-[85vw] md:w-[400px] space-y-3">
                {[
                  { rank: 5, name: "Neon Pulse", wins: 31, battles: 40, flag: "🇺🇸", city: "Miami, FL" },
                  { rank: 6, name: "Verbal Storm", wins: 29, battles: 38, flag: "🇺🇸", city: "Chicago, IL" },
                  { rank: 7, name: "Flow Master", wins: 28, battles: 37, flag: "🇺🇸", city: "Oakland, CA" },
                  { rank: 8, name: "Beat Prophet", wins: 26, battles: 35, flag: "🇺🇸", city: "Detroit, MI" },
                ].map((artist) => (
                  <Link key={artist.rank}
                    to={`/artist/${artist.name.toLowerCase().replace(" ", "-")}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs bg-muted text-muted-foreground">
                      {artist.rank}
                    </div>
                    <Avatar className="size-10">
                      <AvatarImage src="/diverse-user-avatars.png" />
                      <AvatarFallback>{artist.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{artist.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{artist.city}</div>
                    </div>
                    <div className="text-xl shrink-0">{artist.flag}</div>
                  </Link>
                ))}
              </div>

              {/* Card 3: Ranks 9-12 */}
              <div className="shrink-0 w-[85vw] md:w-[400px] space-y-3">
                {[
                  { rank: 9, name: "Lyric Sage", wins: 25, battles: 34, flag: "🇺🇸", city: "Philadelphia, PA" },
                  { rank: 10, name: "Cipher King", wins: 24, battles: 33, flag: "🇺🇸", city: "Seattle, WA" },
                  { rank: 11, name: "Mic Assassin", wins: 23, battles: 32, flag: "🇺🇸", city: "Boston, MA" },
                  { rank: 12, name: "Rhyme Dealer", wins: 22, battles: 31, flag: "🇺🇸", city: "Denver, CO" },
                ].map((artist) => (
                  <Link key={artist.rank}
                    to={`/artist/${artist.name.toLowerCase().replace(" ", "-")}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs bg-muted text-muted-foreground">
                      {artist.rank}
                    </div>
                    <Avatar className="size-10">
                      <AvatarImage src="/diverse-user-avatars.png" />
                      <AvatarFallback>{artist.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{artist.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{artist.city}</div>
                    </div>
                    <div className="text-xl shrink-0">{artist.flag}</div>
                  </Link>
                ))}
              </div>

              {/* Card 4: Ranks 13-16 */}
              <div className="shrink-0 w-[85vw] md:w-[400px] space-y-3">
                {[
                  { rank: 13, name: "Verse Viper", wins: 21, battles: 30, flag: "🇺🇸", city: "Phoenix, AZ" },
                  { rank: 14, name: "Boom Bap", wins: 20, battles: 29, flag: "🇺🇸", city: "Portland, OR" },
                  { rank: 15, name: "Word Smith", wins: 19, battles: 28, flag: "🇺🇸", city: "Nashville, TN" },
                  { rank: 16, name: "Bass Cannon", wins: 18, battles: 27, flag: "🇺🇸", city: "Las Vegas, NV" },
                ].map((artist) => (
                  <Link key={artist.rank}
                    to={`/artist/${artist.name.toLowerCase().replace(" ", "-")}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs bg-muted text-muted-foreground">
                      {artist.rank}
                    </div>
                    <Avatar className="size-10">
                      <AvatarImage src="/diverse-user-avatars.png" />
                      <AvatarFallback>{artist.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{artist.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{artist.city}</div>
                    </div>
                    <div className="text-xl shrink-0">{artist.flag}</div>
                  </Link>
                ))}
              </div>

              {/* Card 5: Ranks 17-20 */}
              <div className="shrink-0 w-[85vw] md:w-[400px] space-y-3">
                {[
                  { rank: 17, name: "Echo Chamber", wins: 17, battles: 26, flag: "🇺🇸", city: "Austin, TX" },
                  { rank: 18, name: "Metaphor", wins: 16, battles: 25, flag: "🇺🇸", city: "San Diego, CA" },
                  { rank: 19, name: "Syllable", wins: 15, battles: 24, flag: "🇺🇸", city: "Charlotte, NC" },
                  { rank: 20, name: "Rhythm Rebel", wins: 14, battles: 23, flag: "🇺🇸", city: "Minneapolis, MN" },
                ].map((artist) => (
                  <Link key={artist.rank}
                    to={`/artist/${artist.name.toLowerCase().replace(" ", "-")}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs bg-muted text-muted-foreground">
                      {artist.rank}
                    </div>
                    <Avatar className="size-10">
                      <AvatarImage src="/diverse-user-avatars.png" />
                      <AvatarFallback>{artist.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{artist.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{artist.city}</div>
                    </div>
                    <div className="text-xl shrink-0">{artist.flag}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Upcoming Battles */}
        <section className="mb-6 md:mb-8">
          <SectionHeader
            title="Upcoming Battles"
            description="Scheduled for the next 24 hours"
            icon={<Calendar className="size-6 text-primary" />}
            viewAllHref="/battles/upcoming"
          />

          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
            <div className="flex gap-3 md:gap-4 md:grid md:grid-cols-2 lg:grid-cols-3 min-w-max md:min-w-0">
              {[
                {
                  id: "upcoming-1",
                  artist1: "Electric Karma",
                  artist2: "Sound Architect",
                  genre: "Electronic",
                  startsIn: "2 hours",
                  format: "Best of 5",
                  artist1Avatar: "/placeholder.svg?height=48&width=48",
                  artist2Avatar: "/placeholder.svg?height=48&width=48",
                  artist1Wins: 24,
                  artist2Wins: 18,
                  artist1WinRate: 75,
                  artist2WinRate: 62,
                  artist1TopSongs: ["Electric Dreams", "Neon Nights", "Digital Love"],
                  artist2TopSongs: ["Sound Wave", "Audio Architecture", "Sonic Boom"],
                },
                {
                  id: "upcoming-2",
                  artist1: "Midnight Poet",
                  artist2: "Urban Legend",
                  genre: "Hip-Hop",
                  startsIn: "6 hours",
                  format: "Best of 3",
                  artist1Avatar: "/placeholder.svg?height=48&width=48",
                  artist2Avatar: "/placeholder.svg?height=48&width=48",
                  artist1Wins: 32,
                  artist2Wins: 28,
                  artist1WinRate: 82,
                  artist2WinRate: 78,
                  artist1TopSongs: ["Midnight Rhymes", "Poetic Justice", "Dark Verses"],
                  artist2TopSongs: ["Street Tales", "City Chronicles", "Urban Stories"],
                },
                {
                  id: "upcoming-3",
                  artist1: "Neon Dreams",
                  artist2: "Crystal Vision",
                  genre: "Synthwave",
                  startsIn: "12 hours",
                  format: "Best of 7",
                  artist1Avatar: "/placeholder.svg?height=48&width=48",
                  artist2Avatar: "/placeholder.svg?height=48&width=48",
                  artist1Wins: 19,
                  artist2Wins: 21,
                  artist1WinRate: 68,
                  artist2WinRate: 72,
                  artist1TopSongs: ["Neon Lights", "Electric Dreams", "Retro Future"],
                  artist2TopSongs: ["Crystal Clear", "Prism Vision", "Rainbow Road"],
                },
              ].map((battle) => (
                <Card
                  key={battle.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow flex-shrink-0 w-[280px] md:w-auto"
                >
                  <CardContent className="p-4">
                    <Badge variant="outline" className="mb-3">
                      {battle.genre}
                    </Badge>
                    <h3 className="font-semibold text-lg mb-2">
                      {battle.artist1} <span className="text-primary">vs</span> {battle.artist2}
                    </h3>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="size-4" />
                        Starts in {battle.startsIn}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {battle.format}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1">
                        <Bell className="size-4 mr-2" />
                        Remind Me
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="flex-1 bg-transparent">
                            <Users className="size-4 mr-2" />
                            Matchup
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-2xl">Head-to-Head Matchup</DialogTitle>
                            <DialogDescription>Battle Stats & Artist Comparison</DialogDescription>
                          </DialogHeader>

                          <div className="space-y-6">
                            {/* Artist Comparison */}
                            <div className="grid grid-cols-3 gap-4 items-center">
                              <div className="text-center space-y-2">
                                <Avatar className="size-20 mx-auto">
                                  <AvatarImage src={battle.artist1Avatar || "/placeholder.svg"} />
                                  <AvatarFallback>{battle.artist1[0]}</AvatarFallback>
                                </Avatar>
                                <h3 className="font-semibold">{battle.artist1}</h3>
                                <Badge>{battle.genre}</Badge>
                              </div>
                              <div className="text-center">
                                <span className="text-4xl font-bold text-primary">VS</span>
                              </div>
                              <div className="text-center space-y-2">
                                <Avatar className="size-20 mx-auto">
                                  <AvatarImage src={battle.artist2Avatar || "/placeholder.svg"} />
                                  <AvatarFallback>{battle.artist2[0]}</AvatarFallback>
                                </Avatar>
                                <h3 className="font-semibold">{battle.artist2}</h3>
                                <Badge>{battle.genre}</Badge>
                              </div>
                            </div>

                            {/* Stats Table */}
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-1/3">{battle.artist1}</TableHead>
                                  <TableHead className="w-1/3 text-center">Stat</TableHead>
                                  <TableHead className="w-1/3 text-right">{battle.artist2}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="font-medium">{battle.artist1Wins}</TableCell>
                                  <TableCell className="text-center text-muted-foreground">Total Wins</TableCell>
                                  <TableCell className="text-right font-medium">{battle.artist2Wins}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="font-medium">{battle.artist1WinRate}%</TableCell>
                                  <TableCell className="text-center text-muted-foreground">Win Rate</TableCell>
                                  <TableCell className="text-right font-medium">{battle.artist2WinRate}%</TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>

                            {/* Top Songs */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                  <Music className="size-4" />
                                  {battle.artist1} Top Songs
                                </h4>
                                <ul className="space-y-1">
                                  {battle.artist1TopSongs.map((song, idx) => (
                                    <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                                      <span className="text-primary font-medium">{idx + 1}.</span>
                                      {song}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                  <Music className="size-4" />
                                  {battle.artist2} Top Songs
                                </h4>
                                <ul className="space-y-1">
                                  {battle.artist2TopSongs.map((song, idx) => (
                                    <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                                      <span className="text-primary font-medium">{idx + 1}.</span>
                                      {song}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            {/* Battle Details */}
                            <div className="bg-muted p-4 rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Format</span>
                                <Badge variant="secondary">{battle.format}</Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Starts In</span>
                                <span className="font-medium">{battle.startsIn}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Genre</span>
                                <Badge>{battle.genre}</Badge>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Must See Battles */}
        <section className="mb-6 md:mb-8">
          <SectionHeader
            title="Must See Battles"
            description="Top viewed battles from the past week"
            icon={<Eye className="size-6 text-primary" />}
            viewAllHref="/battles/must-see"
          />

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto flex-nowrap mb-4">
              <TabsTrigger value="all">All Genres</TabsTrigger>
              <TabsTrigger value="hip-hop">Hip-Hop</TabsTrigger>
              <TabsTrigger value="rnb">R&B</TabsTrigger>
              <TabsTrigger value="electronic">Electronic</TabsTrigger>
              <TabsTrigger value="pop">Pop</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-0">
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2">
                <div className="flex gap-4">
                  {[
                    {
                      id: "must-see-1",
                      title: "Epic Showdown: East vs West",
                      artist1: "Coast King",
                      artist2: "Bay Legend",
                      views: "2.4M",
                      thumbnail: "/music-battle-video-thumbnail.jpg",
                      duration: "12:34",
                      winner: "Coast King",
                    },
                    {
                      id: "must-see-2",
                      title: "Producer Battle: Beats & Rhymes",
                      artist1: "Beat Master",
                      artist2: "Rhythm Chief",
                      views: "1.8M",
                      thumbnail: "/hip-hop-battle-stage.jpg",
                      duration: "15:22",
                      winner: "Rhythm Chief",
                    },
                    {
                      id: "must-see-3",
                      title: "Underground Kings Finale",
                      artist1: "Shadow MC",
                      artist2: "Night Rapper",
                      views: "1.5M",
                      thumbnail: "/rap-battle-crowd.jpg",
                      duration: "18:45",
                      winner: "Shadow MC",
                    },
                  ].map((battle) => (
                    <Link key={battle.id}
                      to={`/battles/${battle.id}`}
                      className="flex-shrink-0 w-[85vw] md:w-[600px] lg:w-[700px]"
                    >
                      <Card className="overflow-hidden hover:shadow-lg transition-shadow group h-full">
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
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="size-12 md:size-16 rounded-full bg-primary flex items-center justify-center">
                                  <Play className="size-6 md:size-8 fill-primary-foreground text-primary-foreground ml-1" />
                                </div>
                              </div>
                              <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-semibold">
                                {battle.duration}
                              </div>
                            </div>

                            {/* Battle Info */}
                            <div className="flex-1 p-4">
                              <h3 className="font-semibold text-base md:text-lg mb-2 group-hover:text-primary transition-colors">
                                {battle.title}
                              </h3>
                              <div className="flex items-center gap-2 mb-3">
                                <Badge variant="secondary" className="text-xs">
                                  {battle.artist1}
                                </Badge>
                                <span className="text-sm text-muted-foreground">vs</span>
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
                              <p className="text-xs md:text-sm text-muted-foreground">
                                Watch the full battle and see how {battle.winner} took the victory in this epic matchup
                              </p>
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
              <p className="text-center text-muted-foreground py-8">Hip-Hop battles coming soon...</p>
            </TabsContent>

            <TabsContent value="rnb">
              <p className="text-center text-muted-foreground py-8">R&B battles coming soon...</p>
            </TabsContent>

            <TabsContent value="electronic">
              <p className="text-center text-muted-foreground py-8">Electronic battles coming soon...</p>
            </TabsContent>

            <TabsContent value="pop">
              <p className="text-center text-muted-foreground py-8">Pop battles coming soon...</p>
            </TabsContent>
          </Tabs>
        </section>
      </section>
    </section>
  )
}
