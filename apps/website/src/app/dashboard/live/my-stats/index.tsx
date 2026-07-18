import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBattleStatsQuery } from "@/lib/soundkit-api-hooks";

import { columns } from "./-columns";
import { DataTable } from "./-data-table";

export const Route = createFileRoute("/dashboard/live/my-stats/")({
  component: MyStatsPage,
});

function MyStatsPage() {
  const { data: stats = [], isLoading } = useBattleStatsQuery();

  if (isLoading) {
    return (
      <div className="flex h-[450px] w-full flex-col items-center justify-center gap-4 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md">
        <LoaderCircle className="size-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Loading battle statistics...
        </p>
      </div>
    );
  }

  const totalWins = stats.reduce((sum, item) => sum + item.wins, 0);
  const totalLosses = stats.reduce((sum, item) => sum + item.losses, 0);
  const totalBattles = totalWins + totalLosses;
  const overallWinRate =
    totalBattles > 0 ? Math.round((totalWins / totalBattles) * 100) : 0;
  const totalSaves = stats.reduce((sum, item) => sum + item.saves, 0);
  const totalPurchases = stats.reduce((sum, item) => sum + item.purchases, 0);
  const totalRevenue = totalPurchases * 29.99;

  const tableData = stats.map((item) => ({
    ...item,
    winRate: Math.round((item.wins / (item.wins + item.losses || 1)) * 100),
  }));

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
            <CardTitle className="text-3xl font-[family-name:var(--font-outfit)]">
              {totalBattles}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across all tracks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Win Rate</CardDescription>
            <CardTitle className="text-3xl font-[family-name:var(--font-outfit)] text-green-600">
              {overallWinRate}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {totalWins} wins, {totalLosses} losses
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Saves</CardDescription>
            <CardTitle className="text-3xl font-[family-name:var(--font-outfit)]">
              {totalSaves}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">From battle viewers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Estimated Revenue</CardDescription>
            <CardTitle className="text-3xl font-[family-name:var(--font-outfit)]">
              $
              {totalRevenue.toLocaleString(undefined, {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              From {totalPurchases} battle sales
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Track Battle Statistics</CardTitle>
          <CardDescription>
            Performance breakdown for each track. Click a track name to view its
            detailed battle rounds history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={tableData} />
        </CardContent>
      </Card>
    </div>
  );
}
