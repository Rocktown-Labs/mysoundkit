import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Trophy,
  Music,
  BarChart3,
  Swords,
  MapPin,
  TrendingUp,
  Award,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/dashboard/live/")({
  component: BattleHubPage,
});

function BattleHubPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Live</h1>
        <p className="text-muted-foreground">
          Manage battles today, then branch into listening parties and creator
          streams from the new live menu.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Battles</CardTitle>
            <Trophy className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+3</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">67%</div>
            <p className="text-xs text-muted-foreground">
              16 wins out of 24 battles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Current Streak
            </CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3 Wins</div>
            <p className="text-xs text-muted-foreground">Keep it going!</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Leaderboard Rank
            </CardTitle>
            <Award className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">#42</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+5</span> positions this week
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-primary transition-colors">
          <CardHeader>
            <Music className="size-8 text-primary mb-2" />
            <CardTitle>My Kit</CardTitle>
            <CardDescription>
              Organize tracks for best of 3, 5, and 7 battles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard/live/my-kit">
              <Button className="w-full">Manage Kits</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-primary transition-colors">
          <CardHeader>
            <BarChart3 className="size-8 text-primary mb-2" />
            <CardTitle>My Stats</CardTitle>
            <CardDescription>
              View wins, losses, and track performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard/live/my-stats">
              <Button className="w-full">View Stats</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-primary transition-colors">
          <CardHeader>
            <MapPin className="size-8 text-primary mb-2" />
            <CardTitle>Explore Battles</CardTitle>
            <CardDescription>
              Discover live battles and upcoming events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/live">
              <Button className="w-full">Explore</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords className="size-5" />
            Active Battles
          </CardTitle>
          <CardDescription>Your ongoing and upcoming battles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-muted/30">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">Hip-Hop Showdown</p>
                  <Badge variant="destructive">Live Now</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  vs. DJ Shadow • Best of 5
                </p>
                <p className="text-xs text-muted-foreground">Round 3 of 5</p>
              </div>
              <Link to="/live/battles/$id" params={{ id: "1" }}>
                <Button className="w-full sm:w-auto">Join Battle</Button>
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">R&B Challenge</p>
                  <Badge variant="secondary">Upcoming</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  vs. Smooth Beats • Best of 3
                </p>
                <p className="text-xs text-muted-foreground">
                  Starts in 2 hours
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full sm:w-auto bg-transparent"
              >
                View Details
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">Electronic Battle</p>
                  <Badge variant="outline">Scheduled</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  vs. BeatMaster • Best of 7
                </p>
                <p className="text-xs text-muted-foreground">
                  Tomorrow at 8:00 PM
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full sm:w-auto bg-transparent"
              >
                View Details
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-5" />
            Recent Results
          </CardTitle>
          <CardDescription>Your latest battle outcomes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="space-y-1">
                <p className="font-semibold text-sm">Pop Showdown</p>
                <p className="text-xs text-muted-foreground">
                  vs. Melody Queen • Best of 3
                </p>
              </div>
              <Badge className="bg-green-600">Won 2-1</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="space-y-1">
                <p className="font-semibold text-sm">Jazz Battle</p>
                <p className="text-xs text-muted-foreground">
                  vs. Smooth Jazz • Best of 5
                </p>
              </div>
              <Badge variant="destructive">Lost 2-3</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="space-y-1">
                <p className="font-semibold text-sm">Rock Challenge</p>
                <p className="text-xs text-muted-foreground">
                  vs. Guitar Hero • Best of 3
                </p>
              </div>
              <Badge className="bg-green-600">Won 2-0</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
