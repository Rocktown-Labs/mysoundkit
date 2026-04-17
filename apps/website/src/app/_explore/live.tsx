import { Outlet, createFileRoute } from "@tanstack/react-router";

import { LiveRouteShell } from "@/components/explore/live-route-shell";

export const Route = createFileRoute("/_explore/live")({
  component: LiveLayout,
});

function LiveLayout() {
  return (
    <LiveRouteShell>
      <Outlet />
    </LiveRouteShell>
  );
}
