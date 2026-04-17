import { createFileRoute } from "@tanstack/react-router";

import { BattleViewAll } from "@/components/explore/battle-view-all";

export const Route = createFileRoute("/_explore/live/battles/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  return (
    <BattleViewAll
      type="leaderboard"
      title="Battle Leaderboard"
      description="Top 100 battle champions ranked by performance"
    />
  );
}
