import { createFileRoute, Link } from "@tanstack/react-router";
import { Music, Check, GripVertical, Plus, Trophy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data for tracks
const mockTracks = [
  { duration: "3:24", id: 1, plays: 15_234, title: "Summer Vibes" },
  { duration: "4:12", id: 2, plays: 8921, title: "Night Drive" },
  { duration: "3:45", id: 3, plays: 21_543, title: "Midnight Dreams" },
  { duration: "3:58", id: 4, plays: 12_456, title: "City Lights" },
  { duration: "4:32", id: 5, plays: 9876, title: "Ocean Breeze" },
  { duration: "3:15", id: 6, plays: 18_234, title: "Sunrise" },
];

export const Route = createFileRoute("/dashboard/live/my-kit")({
  component: MyKitPage,
});

function MyKitPage() {
  const [bestOf3, setBestOf3] = useState<number[]>([]);
  const [bestOf5, setBestOf5] = useState<number[]>([]);
  const [bestOf7, setBestOf7] = useState<number[]>([]);
  const [tiebreaker, setTiebreaker] = useState<number[]>([]);

  const toggleTrack = (
    trackId: number,
    kit: number[],
    setKit: (kit: number[]) => void,
    maxTracks: number
  ) => {
    if (kit.includes(trackId)) {
      setKit(kit.filter((id) => id !== trackId));
    } else if (kit.length < maxTracks) {
      setKit([...kit, trackId]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">My Battle Kit</h1>
          <p className="text-muted-foreground">
            Organize your tracks for battles
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/">
            <Button variant="outline">
              <Music className="mr-2 size-4" />
              Explore Music
            </Button>
          </Link>
          <Link to="/dashboard/live">
            <Button>
              <Trophy className="mr-2 size-4" />
              Find Battles
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="best-of-3" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="best-of-3">Best of 3</TabsTrigger>
          <TabsTrigger value="best-of-5">Best of 5</TabsTrigger>
          <TabsTrigger value="best-of-7">Best of 7</TabsTrigger>
          <TabsTrigger value="tiebreaker">Tiebreaker</TabsTrigger>
        </TabsList>

        <TabsContent value="best-of-3" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Best of 3 Kit</CardTitle>
              <CardDescription>
                Select up to 3 tracks for best of 3 battles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockTracks.map((track) => (
                  <div
                    key={track.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      bestOf3.includes(track.id)
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="size-4 text-muted-foreground" />
                      <Music className="size-4" />
                      <div>
                        <p className="font-medium">{track.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {track.plays.toLocaleString()} plays •{" "}
                          {track.duration}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={
                        bestOf3.includes(track.id) ? "default" : "outline"
                      }
                      onClick={() =>
                        toggleTrack(track.id, bestOf3, setBestOf3, 3)
                      }
                      disabled={
                        !bestOf3.includes(track.id) && bestOf3.length >= 3
                      }
                    >
                      {bestOf3.includes(track.id) ? (
                        <>
                          <Check className="mr-2 size-4" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 size-4" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {bestOf3.length} / 3 tracks selected
                </p>
                <Button disabled={bestOf3.length !== 3}>Save Kit</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="best-of-5" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Best of 5 Kit</CardTitle>
              <CardDescription>
                Select up to 5 tracks for best of 5 battles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockTracks.map((track) => (
                  <div
                    key={track.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      bestOf5.includes(track.id)
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="size-4 text-muted-foreground" />
                      <Music className="size-4" />
                      <div>
                        <p className="font-medium">{track.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {track.plays.toLocaleString()} plays •{" "}
                          {track.duration}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={
                        bestOf5.includes(track.id) ? "default" : "outline"
                      }
                      onClick={() =>
                        toggleTrack(track.id, bestOf5, setBestOf5, 5)
                      }
                      disabled={
                        !bestOf5.includes(track.id) && bestOf5.length >= 5
                      }
                    >
                      {bestOf5.includes(track.id) ? (
                        <>
                          <Check className="mr-2 size-4" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 size-4" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {bestOf5.length} / 5 tracks selected
                </p>
                <Button disabled={bestOf5.length !== 5}>Save Kit</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="best-of-7" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Best of 7 Kit</CardTitle>
              <CardDescription>
                Select up to 7 tracks for best of 7 battles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockTracks.map((track) => (
                  <div
                    key={track.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      bestOf7.includes(track.id)
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="size-4 text-muted-foreground" />
                      <Music className="size-4" />
                      <div>
                        <p className="font-medium">{track.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {track.plays.toLocaleString()} plays •{" "}
                          {track.duration}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={
                        bestOf7.includes(track.id) ? "default" : "outline"
                      }
                      onClick={() =>
                        toggleTrack(track.id, bestOf7, setBestOf7, 7)
                      }
                      disabled={
                        !bestOf7.includes(track.id) && bestOf7.length >= 7
                      }
                    >
                      {bestOf7.includes(track.id) ? (
                        <>
                          <Check className="mr-2 size-4" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 size-4" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {bestOf7.length} / 7 tracks selected
                </p>
                <Button disabled={bestOf7.length !== 7}>Save Kit</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiebreaker" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tiebreaker Tracks</CardTitle>
              <CardDescription>
                Select up to 2 tracks for tiebreaker rounds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockTracks.map((track) => (
                  <div
                    key={track.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      tiebreaker.includes(track.id)
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="size-4 text-muted-foreground" />
                      <Music className="size-4" />
                      <div>
                        <p className="font-medium">{track.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {track.plays.toLocaleString()} plays •{" "}
                          {track.duration}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={
                        tiebreaker.includes(track.id) ? "default" : "outline"
                      }
                      onClick={() =>
                        toggleTrack(track.id, tiebreaker, setTiebreaker, 2)
                      }
                      disabled={
                        !tiebreaker.includes(track.id) && tiebreaker.length >= 2
                      }
                    >
                      {tiebreaker.includes(track.id) ? (
                        <>
                          <Check className="mr-2 size-4" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 size-4" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {tiebreaker.length} / 2 tracks selected
                </p>
                <Button disabled={tiebreaker.length !== 2}>Save Kit</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
