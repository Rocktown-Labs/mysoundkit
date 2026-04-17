import { createFileRoute } from "@tanstack/react-router";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Play,
  Users,
  Music,
  Eye,
  ArrowUpRight,
  Calendar,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/dashboard/career/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-playfair)]">
          Analytics
        </h1>
        <p className="text-muted-foreground">
          Track your music performance and earnings
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tracks">Tracks</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Plays
                </CardTitle>
                <Play className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12,543</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="size-3 text-green-500" />
                  <span className="text-green-500">+12.5%</span> from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Downloads</CardTitle>
                <Download className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3,421</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="size-3 text-green-500" />
                  <span className="text-green-500">+8.2%</span> from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Followers</CardTitle>
                <Users className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,234</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="size-3 text-green-500" />
                  <span className="text-green-500">+5.1%</span> from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Earnings
                </CardTitle>
                <DollarSign className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$2,847</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="size-3 text-green-500" />
                  <span className="text-green-500">+18.3%</span> from last month
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Plays Over Time</CardTitle>
                <CardDescription>
                  Your track plays in the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] flex items-end justify-between gap-2">
                  {[
                    40, 60, 45, 80, 55, 90, 70, 85, 95, 75, 100, 85, 90, 110,
                  ].map((height, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Tracks</CardTitle>
                <CardDescription>
                  Your most played tracks this month
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { plays: 3421, title: "Summer Vibes", trend: "up" },
                    { plays: 2847, title: "Night Drive", trend: "up" },
                    { plays: 2134, title: "City Lights", trend: "down" },
                    { plays: 1876, title: "Midnight Dreams", trend: "up" },
                  ].map((track, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded flex items-center justify-center">
                          <Music className="size-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{track.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {track.plays.toLocaleString()} plays
                          </p>
                        </div>
                      </div>
                      {track.trend === "up" ? (
                        <TrendingUp className="size-4 text-green-500" />
                      ) : (
                        <TrendingDown className="size-4 text-red-500" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Audience Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Audience Insights</CardTitle>
              <CardDescription>Where your listeners are from</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { country: "United States", listeners: 5643, percentage: 45 },
                  {
                    country: "United Kingdom",
                    listeners: 2258,
                    percentage: 18,
                  },
                  { country: "Canada", listeners: 1505, percentage: 12 },
                  { country: "Australia", listeners: 1003, percentage: 8 },
                  { country: "Germany", listeners: 878, percentage: 7 },
                ].map((location, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{location.country}</span>
                      <span className="text-muted-foreground">
                        {location.listeners.toLocaleString()} listeners
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${location.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tracks" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Track Performance</CardTitle>
              <CardDescription>
                Detailed analytics for each track
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="size-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded flex items-center justify-center">
                        <Music className="size-8 text-white/50" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Track Title {i}</h3>
                        <p className="text-sm text-muted-foreground">
                          Released Jan 2025
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <p className="text-2xl font-bold">
                          {(Math.random() * 5000).toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Plays</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">
                          {(Math.random() * 1000).toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Downloads
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">
                          ${(Math.random() * 500).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">Earned</p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="size-4 mr-2" />
                        Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6 mt-6">
          {/* Earnings Overview */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Available Balance
                </CardTitle>
                <DollarSign className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$2,847.32</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ready to withdraw
                </p>
                <Button className="w-full mt-4" size="sm">
                  Withdraw Funds
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending Earnings
                </CardTitle>
                <Calendar className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$543.21</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Available in 7 days
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Earned
                </CardTitle>
                <TrendingUp className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$12,847.89</div>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>
          </div>

          {/* Transaction History */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Your recent earnings and withdrawals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    amount: 9.99,
                    date: "2 hours ago",
                    status: "completed",
                    track: "Summer Vibes",
                    type: "sale",
                  },
                  {
                    amount: 4.99,
                    date: "5 hours ago",
                    status: "completed",
                    track: "Night Drive",
                    type: "sale",
                  },
                  {
                    amount: -500,
                    date: "1 day ago",
                    status: "completed",
                    track: "Bank Transfer",
                    type: "withdrawal",
                  },
                  {
                    amount: 9.99,
                    date: "2 days ago",
                    status: "completed",
                    track: "City Lights",
                    type: "sale",
                  },
                  {
                    amount: 0,
                    date: "3 days ago",
                    status: "completed",
                    track: "Midnight Dreams",
                    type: "sale",
                  },
                ].map((transaction, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`size-10 rounded-full flex items-center justify-center ${
                          transaction.type === "sale"
                            ? "bg-green-500/10"
                            : "bg-blue-500/10"
                        }`}
                      >
                        {transaction.type === "sale" ? (
                          <ArrowUpRight className="size-5 text-green-500" />
                        ) : (
                          <Download className="size-5 text-blue-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{transaction.track}</p>
                        <p className="text-sm text-muted-foreground">
                          {transaction.date}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold ${transaction.amount >= 0 ? "text-green-500" : "text-blue-500"}`}
                      >
                        {transaction.amount >= 0 ? "+" : ""}$
                        {Math.abs(transaction.amount).toFixed(2)}
                      </p>
                      <Badge variant="outline" className="mt-1">
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
