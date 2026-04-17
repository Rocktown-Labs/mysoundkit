import { createFileRoute } from "@tanstack/react-router";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { columns } from "./-columns";
import type { BattleStats } from "./-columns";
import { DataTable } from "./-data-table";

// Mock data
const data: BattleStats[] = [
  {
    downloads: 156,
    losses: 3,
    purchases: 45,
    saves: 234,
    trackId: "1",
    trackName: "Summer Vibes",
    winRate: 80,
    wins: 12,
  },
  {
    downloads: 98,
    losses: 7,
    purchases: 32,
    saves: 189,
    trackId: "2",
    trackName: "Night Drive",
    winRate: 53,
    wins: 8,
  },
  {
    downloads: 234,
    losses: 2,
    purchases: 78,
    saves: 345,
    trackId: "3",
    trackName: "Midnight Dreams",
    winRate: 88,
    wins: 15,
  },
  {
    downloads: 134,
    losses: 5,
    purchases: 56,
    saves: 198,
    trackId: "4",
    trackName: "City Lights",
    winRate: 67,
    wins: 10,
  },
  {
    downloads: 87,
    losses: 9,
    purchases: 23,
    saves: 156,
    trackId: "5",
    trackName: "Ocean Breeze",
    winRate: 40,
    wins: 6,
  },
];

export const Route = createFileRoute("/dashboard/live/my-stats/")({
  component: MyStatsPage,
});

function MyStatsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">My Battle Stats</h1>
        <p className="text-muted-foreground">
          Track performance of your songs in battles
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Battles</CardDescription>
            <CardTitle className="text-3xl">68</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across all tracks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Win Rate</CardDescription>
            <CardTitle className="text-3xl text-green-600">68%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">51 wins, 17 losses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Saves</CardDescription>
            <CardTitle className="text-3xl">1,122</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">From battle viewers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revenue</CardDescription>
            <CardTitle className="text-3xl">$234</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              From battle purchases
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Track Battle Statistics</CardTitle>
          <CardDescription>
            Performance breakdown for each track
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
