import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, MapPin, Music, Swords, Trophy } from "lucide-react";
import type React from "react";

import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useBattlesQuery,
  useCreateBattleChallengeMutation,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/")({
  component: BattleHubPage,
});

function BattleHubPage() {
  const battlesQuery = useBattlesQuery();
  const createChallenge = useCreateBattleChallengeMutation();
  const battles = battlesQuery.data ?? [];
  const liveBattles = battles.filter((battle) => battle.status === "live");
  const scheduledBattles = battles.filter(
    (battle) => battle.status === "scheduled"
  );

  const submitChallenge = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createChallenge.mutate({
      format: String(form.get("format") ?? "best_of_3") as
        | "best_of_3"
        | "best_of_5"
        | "best_of_7",
      genre: String(form.get("genre") ?? "Open Format"),
      message: String(form.get("message") ?? ""),
      opponentUsername: String(form.get("opponentUsername") ?? ""),
      proposedDate: String(form.get("proposedDate") ?? ""),
      proposedTimeLabel: String(form.get("proposedTimeLabel") ?? ""),
    });
    event.currentTarget.reset();
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl font-bold">
            Battles
          </h1>
          <p className="text-muted-foreground">
            Start challenges, join live battles, and manage your battle kit.
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/live/my-kit">
            <Music className="mr-2 size-4" />
            My Kits
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Battles" value={battles.length} />
        <MetricCard label="Live Now" value={liveBattles.length} />
        <MetricCard label="Scheduled" value={scheduledBattles.length} />
        <MetricCard
          label="Viewers"
          value={battles.reduce(
            (total, battle) => total + battle.viewerCount,
            0
          )}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="size-5 text-primary" />
              Battle Feed
            </CardTitle>
            <CardDescription>
              Live and scheduled battles from the SoundKit API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {battlesQuery.isLoading && (
              <p className="text-sm text-muted-foreground">
                Loading battles...
              </p>
            )}

            {!battlesQuery.isLoading && battles.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="font-semibold">No battles yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a challenge to start your first matchup.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {battles.map((battle) => (
                <div
                  className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={battle.id}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{battle.title}</p>
                      <Badge
                        variant={
                          battle.status === "live" ? "destructive" : "outline"
                        }
                      >
                        {battle.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {battle.genre} - {battle.format.replaceAll("_", " ")} -{" "}
                      {battle.viewerCount.toLocaleString()} viewers
                    </p>
                  </div>
                  <Button asChild className="w-full sm:w-auto">
                    <Link params={{ id: battle.id }} to="/live/battles/$id">
                      {battle.status === "live" ? "Join Battle" : "View"}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Start a Challenge</CardTitle>
              <CardDescription>
                Send a battle challenge to another artist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submitChallenge}>
                <div className="space-y-2">
                  <Label htmlFor="opponentUsername">Opponent</Label>
                  <Input
                    id="opponentUsername"
                    name="opponentUsername"
                    placeholder="@artist"
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="format">Format</Label>
                    <Select defaultValue="best_of_3" name="format">
                      <SelectTrigger id="format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="best_of_3">Best of 3</SelectItem>
                        <SelectItem value="best_of_5">Best of 5</SelectItem>
                        <SelectItem value="best_of_7">Best of 7</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="genre">Genre</Label>
                    <Input id="genre" name="genre" placeholder="Rap" required />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="proposedDate">Date</Label>
                    <Input id="proposedDate" name="proposedDate" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proposedTimeLabel">Time</Label>
                    <Input
                      id="proposedTimeLabel"
                      name="proposedTimeLabel"
                      placeholder="8:00 PM ET"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Set the tone for the matchup."
                    rows={3}
                  />
                </div>
                <Button className="w-full" disabled={createChallenge.isPending}>
                  <Trophy className="mr-2 size-4" />
                  {createChallenge.isPending ? "Sending..." : "Create Battle"}
                </Button>
                {createChallenge.isSuccess && (
                  <p className="text-center text-sm text-muted-foreground">
                    Challenge sent.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <QuickLink
              description="Pick battle-ready songs."
              icon={Music}
              label="My Kit"
              to="/dashboard/live/my-kit"
            />
            <QuickLink
              description="Wins, losses, and track performance."
              icon={BarChart3}
              label="My Stats"
              to="/dashboard/live/my-stats"
            />
            <QuickLink
              description="Browse public battles."
              icon={MapPin}
              label="Explore"
              to="/live/battles"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-bold">
        {value.toLocaleString()}
      </CardContent>
    </Card>
  );
}

function QuickLink({
  description,
  icon: Icon,
  label,
  to,
}: {
  description: string;
  icon: typeof Music;
  label: string;
  to: "/dashboard/live/my-kit" | "/dashboard/live/my-stats" | "/live/battles";
}) {
  return (
    <Card>
      <CardHeader>
        <Icon className="mb-2 size-6 text-primary" />
        <CardTitle>{label}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full" variant="outline">
          <Link to={to}>Open</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
