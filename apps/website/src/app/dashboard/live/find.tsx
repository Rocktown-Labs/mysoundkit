import { createFileRoute } from "@tanstack/react-router";
import { Search, Calendar, Clock, MapPin, Music2, Zap } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/dashboard/live/find")({
  component: FindBattlePage,
});

function FindBattlePage() {
  const [searchType, setSearchType] = useState<"quick" | "scheduled">("quick");

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <Search className="size-8 text-primary" />
          Find a Battle
        </h1>
        <p className="text-muted-foreground">
          Challenge an artist or join an open battle
        </p>
      </div>

      <Tabs
        value={searchType}
        onValueChange={(v) => setSearchType(v as "quick" | "scheduled")}
        className="max-w-3xl"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="quick">
            <Zap className="mr-2 size-4" />
            Quick Match
          </TabsTrigger>
          <TabsTrigger value="scheduled">
            <Calendar className="mr-2 size-4" />
            Schedule Battle
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quick" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Match</CardTitle>
              <CardDescription>
                Find an available battle starting in the next 30 minutes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="genre">Genre</Label>
                <Select>
                  <SelectTrigger id="genre">
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
                <Label htmlFor="format">Battle Format</Label>
                <Select defaultValue="best-of-3">
                  <SelectTrigger id="format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="best-of-3">Best of 3</SelectItem>
                    <SelectItem value="best-of-5">Best of 5</SelectItem>
                    <SelectItem value="best-of-7">Best of 7</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location Preference</Label>
                <Select defaultValue="local">
                  <SelectTrigger id="location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local (Same City)</SelectItem>
                    <SelectItem value="state">Same State</SelectItem>
                    <SelectItem value="national">National</SelectItem>
                    <SelectItem value="global">Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Start Time</Label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" />
                  <span>Battle starts within 30 minutes of matching</span>
                </div>
              </div>

              <Button className="w-full" size="lg">
                <Search className="mr-2 size-5" />
                Find Quick Match
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule a Battle</CardTitle>
              <CardDescription>
                Set a specific date and time for your battle
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="opponent">Search Opponent (Optional)</Label>
                <Input
                  id="opponent"
                  placeholder="Search by username or leave empty for open challenge"
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to create an open challenge
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled-genre">Genre</Label>
                <Select>
                  <SelectTrigger id="scheduled-genre">
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
                <Label htmlFor="scheduled-format">Battle Format</Label>
                <Select defaultValue="best-of-5">
                  <SelectTrigger id="scheduled-format">
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
                  <Label htmlFor="battle-date">Date</Label>
                  <Input
                    id="battle-date"
                    type="date"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="battle-time">Time</Label>
                  <Input
                    id="battle-time"
                    type="time"
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled-location">Location</Label>
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" />
                  <Input
                    id="scheduled-location"
                    placeholder="Los Angeles, CA"
                    className="bg-background"
                  />
                </div>
              </div>

              <Button className="w-full" size="lg">
                <Calendar className="mr-2 size-5" />
                Schedule Battle
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Available Battles */}
      <div className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-bold mb-4">Open Battles</h2>
        <p className="text-muted-foreground mb-6">
          Join an existing battle challenge
        </p>

        <div className="space-y-4">
          {[
            {
              artist: "Metro Flow",
              format: "Best of 5",
              genre: "Hip-Hop",
              location: "Los Angeles, CA",
              time: "In 45 minutes",
            },
            {
              artist: "Neon Pulse",
              format: "Best of 3",
              genre: "Electronic",
              location: "New York, NY",
              time: "Tomorrow at 8:00 PM",
            },
            {
              artist: "Luna Eclipse",
              format: "Best of 7",
              genre: "R&B/Soul",
              location: "Atlanta, GA",
              time: "In 2 hours",
            },
          ].map((battle, idx) => (
            <Card key={idx} className="hover:bg-accent/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Music2 className="size-5 text-primary" />
                      <h3 className="font-semibold text-lg">{battle.artist}</h3>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      <span>Genre: {battle.genre}</span>
                      <span>Format: {battle.format}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {battle.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {battle.location}
                      </span>
                    </div>
                  </div>
                  <Button>Accept Challenge</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
