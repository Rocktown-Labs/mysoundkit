import { createFileRoute } from "@tanstack/react-router"
import { DataTable } from "./-data-table"
import { columns, type BattleStats } from "./-columns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Mock data
const data: BattleStats[] = [
  {
    trackId: "1",
    trackName: "Summer Vibes",
    wins: 12,
    losses: 3,
    winRate: 80,
    saves: 234,
    downloads: 156,
    purchases: 45,
  },
  {
    trackId: "2",
    trackName: "Night Drive",
    wins: 8,
    losses: 7,
    winRate: 53,
    saves: 189,
    downloads: 98,
    purchases: 32,
  },
  {
    trackId: "3",
    trackName: "Midnight Dreams",
    wins: 15,
    losses: 2,
    winRate: 88,
    saves: 345,
    downloads: 234,
    purchases: 78,
  },
  {
    trackId: "4",
    trackName: "City Lights",
    wins: 10,
    losses: 5,
    winRate: 67,
    saves: 198,
    downloads: 134,
    purchases: 56,
  },
  {
    trackId: "5",
    trackName: "Ocean Breeze",
    wins: 6,
    losses: 9,
    winRate: 40,
    saves: 156,
    downloads: 87,
    purchases: 23,
  },
]

export const Route = createFileRoute('/dashboard/battles/my-stats/')({
  component: MyStatsPage,
})

function MyStatsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">My Battle Stats</h1>
        <p className="text-muted-foreground">Track performance of your songs in battles</p>
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
            <p className="text-xs text-muted-foreground">From battle purchases</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Track Battle Statistics</CardTitle>
          <CardDescription>Performance breakdown for each track</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={data} />
        </CardContent>
      </Card>
    </div>
  )
}
