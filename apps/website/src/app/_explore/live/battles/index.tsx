import { createFileRoute } from "@tanstack/react-router";

import { BattleViewAll } from "@/components/explore/battle-view-all";

export const Route = createFileRoute("/_explore/live/battles/")({
  component: LiveBattlesPage,
  validateSearch: (search: Record<string, unknown>) => ({
    genre: typeof search.genre === "string" ? search.genre : undefined,
    region: typeof search.region === "string" ? search.region : undefined,
    regionType: search.regionType === "global" ? "global" : "north-america",
    sort: typeof search.sort === "string" ? search.sort : undefined,
  }),
});

function LiveBattlesPage() {
  return (
    <BattleViewAll
      description="Watch battles happening right now"
      title="Live Battles"
      type="live"
    />
  );
}
