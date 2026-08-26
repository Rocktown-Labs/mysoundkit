import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_explore/live/battles/leaderboard")({
  beforeLoad: () => {
    throw redirect({
      search: {
        genre: undefined,
        region: undefined,
        regionType: "north-america",
        sort: undefined,
      },
      to: "/live/battles",
    });
  },
});
