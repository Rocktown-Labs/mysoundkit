import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useBattleRecordQuery,
  useBattleStatsQuery,
} from "@/lib/soundkit-api-hooks";

import { columns } from "./-columns";
import { DataTable } from "./-data-table";

export const Route = createFileRoute("/dashboard/live/my-stats/")({
  component: MyStatsPage,
});

const emptyRecordSummary = {
    battles: 0,
    canceled: 0,
    ducks: 0,
    forfeits: 0,
    losses: 0,
    quits: 0,
    roundsPlayed: 0,
    ties: 0,
    wins: 0,
  },
  resultDetails = {
    canceled: { label: "Canceled", tone: "text-muted-foreground" },
    ducked: { label: "Ducked", tone: "text-amber-400" },
    forfeited: { label: "Forfeited", tone: "text-red-400" },
    loss: { label: "Loss", tone: "text-red-400" },
    quit: { label: "Quit", tone: "text-red-400" },
    tie: { label: "Tie", tone: "text-amber-400" },
    win: { label: "Win", tone: "text-emerald-400" },
  } as const;

function MyStatsPage() {
  const { data: stats = [], isLoading } = useBattleStatsQuery(),
    { data: record, isLoading: isRecordLoading } = useBattleRecordQuery();

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

  const ranked = record?.ranked ?? emptyRecordSummary,
    participation = record?.participation ?? emptyRecordSummary,
    totalWins = stats.reduce((sum, item) => sum + item.wins, 0),
    totalLosses = stats.reduce((sum, item) => sum + item.losses, 0),
    totalTies = stats.reduce((sum, item) => sum + item.ties, 0),
    totalBattles = totalWins + totalLosses + totalTies,
    overallWinRate =
      totalBattles > 0 ? Math.round((totalWins / totalBattles) * 100) : 0,
    totalSaves = stats.reduce((sum, item) => sum + item.saves, 0),
    totalPurchases = stats.reduce((sum, item) => sum + item.purchases, 0),
    tableData = stats.map((item) => ({
      ...item,
      winRate: Math.round(
        (item.wins / (item.wins + item.losses + item.ties || 1)) * 100
      ),
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl md:text-3xl">My Battle Stats</h1>
        <p className="text-muted-foreground">
          Track your ranked record, song performance, and every battle you play.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Ranked record</CardTitle>
                <CardDescription>
                  Only battles reaching 10 peak viewers affect this record.
                </CardDescription>
              </div>
              <Badge variant="outline">{ranked.battles} ranked</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[
              ["Wins", ranked.wins, "text-emerald-400"],
              ["Losses", ranked.losses, "text-red-400"],
              ["Ties", ranked.ties, "text-amber-400"],
              ["Ducks", ranked.ducks, "text-amber-400"],
              ["Forfeits", ranked.forfeits, "text-red-400"],
              ["Quits", ranked.quits, "text-red-400"],
            ].map(([label, value, tone]) => (
              <div key={label}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p className={`mt-1 font-mono font-bold text-lg ${tone}`}>
                  {value}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Battle participation</CardTitle>
            <CardDescription>
              Practice and low-audience battles still count toward your
              activity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-mono font-bold text-2xl">
              {participation.battles} battles
            </p>
            <p className="text-xs text-muted-foreground">
              {participation.roundsPlayed} rounds played · {participation.wins}{" "}
              wins · {participation.ties} ties
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent battle participation</CardTitle>
          <CardDescription>
            Every completed, canceled, ducked, forfeited, and quit battle is
            kept here. Low-audience matches do not change the ranked record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isRecordLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading battle history...
            </p>
          ) : record?.history.length ? (
            <div className="divide-y divide-border/60">
              {record.history.map((entry) => {
                const details = resultDetails[entry.result];
                return (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                    key={`${entry.battleId}-${entry.recordedAt}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-sm">
                        {entry.battleTitle}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.roundsPlayed} rounds ·{" "}
                        {new Date(entry.recordedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={details.tone} variant="outline">
                        {details.label}
                      </Badge>
                      <Badge variant="secondary">
                        {entry.isRanked ? "Ranked" : "Practice"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your battle participation will appear here after your first match.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Track Battles</CardDescription>
            <CardTitle className="font-[family-name:var(--font-outfit)] text-3xl">
              {totalBattles}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across all tracks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Track Win Rate</CardDescription>
            <CardTitle className="font-[family-name:var(--font-outfit)] text-3xl text-green-600">
              {overallWinRate}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {totalWins} wins, {totalLosses} losses, {totalTies} ties
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Saves</CardDescription>
            <CardTitle className="font-[family-name:var(--font-outfit)] text-3xl">
              {totalSaves}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">From battle viewers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Battle Purchases</CardDescription>
            <CardTitle className="font-[family-name:var(--font-outfit)] text-3xl">
              {totalPurchases}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Direct music purchases from battle viewers
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
