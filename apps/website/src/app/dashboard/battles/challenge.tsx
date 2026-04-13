import { createFileRoute } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"

import { useState } from "react"
import { Swords, Search, Music2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export const Route = createFileRoute('/dashboard/battles/challenge')({
  component: ChallengePage,
})

function ChallengePage() {
  const [searchQuery, setSearchQuery] = useState("")

  const suggestedArtists = [
    { username: "metro_flow", name: "Metro Flow", genre: "Hip-Hop", followers: "12.5K" },
    { username: "neon_pulse", name: "Neon Pulse", genre: "Electronic", followers: "8.2K" },
    { username: "luna_eclipse", name: "Luna Eclipse", genre: "R&B/Soul", followers: "15.1K" },
  ]

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <Swords className="size-8 text-primary" />
          Challenge an Artist
        </h1>
        <p className="text-muted-foreground">Send a direct battle challenge to another artist</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 max-w-6xl">
        {/* Challenge Form */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Create Challenge</CardTitle>
              <CardDescription>Fill out the details to challenge an artist</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="opponent-search">Search Artist</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="opponent-search"
                    placeholder="Search by username"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="challenge-genre">Genre</Label>
                <Select>
                  <SelectTrigger id="challenge-genre">
                    <SelectValue placeholder="Select genre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                    <SelectItem value="rb-soul">R&B/Soul</SelectItem>
                    <SelectItem value="electronic">Electronic</SelectItem>
                    <SelectItem value="pop">Pop</SelectItem>
                    <SelectItem value="rock">Rock</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="challenge-format">Battle Format</Label>
                <Select defaultValue="best-of-5">
                  <SelectTrigger id="challenge-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="best-of-3">Best of 3</SelectItem>
                    <SelectItem value="best-of-5">Best of 5</SelectItem>
                    <SelectItem value="best-of-7">Best of 7</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="challenge-date">Proposed Date</Label>
                  <Input id="challenge-date" type="date" className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="challenge-time">Proposed Time</Label>
                  <Input id="challenge-time" type="time" className="bg-background" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="challenge-message">Challenge Message (Optional)</Label>
                <Textarea
                  id="challenge-message"
                  placeholder="Add a message to your challenge..."
                  rows={4}
                  className="resize-none bg-background"
                />
              </div>

              <Button className="w-full" size="lg">
                <Swords className="mr-2 size-5" />
                Send Challenge
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Suggested Artists */}
        <div>
          <h2 className="text-xl font-bold mb-4">Suggested Artists</h2>
          <p className="text-sm text-muted-foreground mb-6">Popular artists in your genre</p>

          <div className="space-y-4">
            {suggestedArtists.map((artist) => (
              <Card key={artist.username} className="hover:bg-accent/50 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Music2 className="size-5 text-primary" />
                        <h3 className="font-semibold">{artist.name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">@{artist.username}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{artist.genre}</span>
                        <span>•</span>
                        <span>{artist.followers} followers</span>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setSearchQuery(artist.username)}>
                      Challenge
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Challenges */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Recent Challenges</h2>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b">
                    <div>
                      <p className="font-medium">Challenge to Metro Flow</p>
                      <p className="text-sm text-muted-foreground">Sent 2 days ago</p>
                    </div>
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Challenge to Voltage Dreams</p>
                      <p className="text-sm text-muted-foreground">Sent 1 week ago</p>
                    </div>
                    <Badge>Accepted</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
