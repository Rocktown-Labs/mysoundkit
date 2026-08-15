import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  LoaderCircle,
  Users,
  Trophy,
  ThumbsUp,
  Percent,
  Swords,
  Play,
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
import { useTrackBattleHistoryQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/my-stats/$trackId")({
  component: TrackBattleHistoryPage,
});

function TrackBattleHistoryPage() {
  const { trackId } = Route.useParams(),
   {
    data: trackHistory,
    isLoading,
    error,
  } = useTrackBattleHistoryQuery(trackId);

  if (isLoading) {
    return (
      <div className="flex h-[450px] w-full flex-col items-center justify-center gap-4 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md">
        <LoaderCircle className="size-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Loading battle history...
        </p>
      </div>
    );
  }

  if (error || !trackHistory) {
    return (
      <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/20 bg-destructive/5 text-center px-4">
        <p className="text-destructive font-semibold">
          Failed to load battle history
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          There was an issue retrieving this track&apos;s history. Please verify
          the track ID or try again.
        </p>
        <Button asChild variant="outline">
          <Link to="/dashboard/live/my-stats">
            <ArrowLeft className="mr-2 size-4" />
            Back to Stats
          </Link>
        </Button>
      </div>
    );
  }

  const { trackName, stats, history } = trackHistory,
   totalRounds = history.length,
   winRate = Math.round(
    (stats.wins / (stats.wins + stats.losses || 1)) * 100
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          asChild
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
        >
          <Link to="/dashboard/live/my-stats">
            <ArrowLeft className="mr-2 size-4" />
            Back to My Stats
          </Link>
        </Button>
        <Badge
          variant="outline"
          className="bg-primary/5 text-primary border-primary/20"
        >
          Track Battle Profile
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Swords className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {trackName}
            </h1>
            <p className="text-xs text-muted-foreground">
              Detailed battle history and round analytics
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Trophy className="size-3.5 text-yellow-500" />
              Win / Loss Record
            </CardDescription>
            <CardTitle className="text-2xl font-[family-name:var(--font-outfit)] text-foreground">
              {stats.wins}W - {stats.losses}L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Across {totalRounds} battle rounds
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Percent className="size-3.5 text-primary" />
              Win Rate
            </CardDescription>
            <CardTitle className="text-2xl font-[family-name:var(--font-outfit)] text-green-600">
              {winRate}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Success in match-ups
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ThumbsUp className="size-3.5 text-sky-500" />
              Total Saves
            </CardDescription>
            <CardTitle className="text-2xl font-[family-name:var(--font-outfit)] text-foreground">
              {stats.saves}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Saved to viewer libraries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Users className="size-3.5 text-indigo-500" />
              Engagement
            </CardDescription>
            <CardTitle className="text-2xl font-[family-name:var(--font-outfit)] text-foreground">
              {stats.downloads + stats.purchases}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.downloads} downloads, {stats.purchases} sales
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Battle Rounds History</CardTitle>
          <CardDescription>
            Chronological log of matchups and voting results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border/40 rounded-xl bg-muted/10">
              <Swords className="size-8 text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm font-semibold">No battles yet</p>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">
                This track has not participated in any battles yet. Start or
                accept a battle challenge to begin!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((round) => {
                const totalVotes = round.votesFor + round.votesAgainst,
                 votePercentage =
                  totalVotes > 0
                    ? Math.round((round.votesFor / totalVotes) * 100)
                    : 50,
                 isWinner = round.winningTrackId === trackId;

                return (
                  <div
                    key={`${round.battleId}-${round.roundNumber}`}
                    className="p-4 rounded-xl border border-border/40 bg-card/60 hover:bg-card/90 transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                          Round {round.roundNumber} • {round.battleTitle}
                        </span>
                        <h4 className="font-bold text-base flex items-center gap-2">
                          vs. {round.opponentTrackName || "Unknown Opponent"}
                          {round.isTiebreaker && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20"
                            >
                              Tiebreaker
                            </Badge>
                          )}
                        </h4>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          className={
                            isWinner
                              ? "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20"
                              : "bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20"
                          }
                          variant="outline"
                        >
                          {isWinner ? "Won" : "Lost"}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="size-3.5" />
                          {round.viewerCount} live viewers
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>
                          {round.votesFor} votes ({votePercentage}%)
                        </span>
                        <span className="text-muted-foreground">
                          {round.votesAgainst} votes ({100 - votePercentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-500"
                          style={{ width: `${votePercentage}%` }}
                        />
                        <div
                          className="h-full bg-muted-foreground/20"
                          style={{ width: `${100 - votePercentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/20 pt-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3.5" />
                        {new Date(round.createdAt).toLocaleDateString(
                          undefined,
                          {
                            dateStyle: "medium",
                          }
                        )}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] hover:text-foreground"
                      >
                        <Play className="mr-1 size-3" />
                        View Battle Replay
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
