import { createFileRoute } from "@tanstack/react-router";

import { BattleViewAll } from "@/components/explore/battle-view-all";

export const Route = createFileRoute("/_explore/live/battles/upcoming")({
  component: UpcomingBattlesPage,
});

function UpcomingBattlesPage() {
  return (
    <BattleViewAll
      type="upcoming"
      title="Upcoming Battles"
      description="Scheduled battles for the next 24 hours"
    />
  );
}
