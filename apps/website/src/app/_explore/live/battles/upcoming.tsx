import { createFileRoute } from "@tanstack/react-router";

import { BattleBoostCard } from "@/components/ads/battle-boost-card";
import { BattleViewAll } from "@/components/explore/battle-view-all";

export const Route = createFileRoute("/_explore/live/battles/upcoming")({
  component: UpcomingBattlesPage,
});

function UpcomingBattlesPage() {
  return (
    <div className="space-y-6">
      <BattleBoostCard />
      <BattleViewAll
        description="See the next battles and join the waiting room before they begin."
        title="Upcoming Battles"
        type="upcoming"
      />
    </div>
  );
}
