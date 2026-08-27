import { createFileRoute } from "@tanstack/react-router";

import { BattleViewAll } from "@/components/explore/battle-view-all";

export const Route = createFileRoute("/_explore/live/battles/upcoming")({
  component: UpcomingBattlesPage,
});

function UpcomingBattlesPage() {
  return (
    <BattleViewAll
      description="See the next battles and join the waiting room before they begin."
      title="Upcoming Battles"
      type="upcoming"
    />
  );
}
