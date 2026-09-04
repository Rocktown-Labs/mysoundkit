import { Outlet, createFileRoute } from "@tanstack/react-router";

import { BioDashboardShell } from "@/components/bio-dashboard-shell";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <BioDashboardShell>
      <Outlet />
    </BioDashboardShell>
  );
}
