import { createFileRoute } from "@tanstack/react-router";

import { BattleViewAll } from "@/components/explore/battle-view-all";

export const Route = createFileRoute("/_explore/live/battles/must-see")({
  component: MustSeeBattlesPage,
});

function MustSeeBattlesPage() {
  return (
    <BattleViewAll
      type="must-see"
      title="Must See Battles"
      description="Most viewed battles from the past week"
    />
  );
}
