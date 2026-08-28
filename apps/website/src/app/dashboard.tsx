import {
  ClientOnly,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { SidebarProvider } from "@/components/ui/sidebar";
import { requireDashboardUser } from "@/lib/soundkit.functions";

/* eslint-disable no-use-before-define */
export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => requireDashboardUser(),
  component: DashboardLayout,
});

function DashboardLayout() {
  const pathname = useRouterState({
      select: (state) => state.location.pathname,
    }),
    isArtistBattleRoom = pathname.startsWith("/dashboard/live/battles/join/");

  return (
    <SidebarProvider defaultOpen={true}>
      <div
        className={
          isArtistBattleRoom
            ? "flex h-svh max-h-svh w-full overflow-hidden"
            : "flex min-h-screen w-full"
        }
      >
        <AppSidebar />
        <div
          className={
            isArtistBattleRoom
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              : "flex flex-1 flex-col"
          }
        >
          <ClientOnly
            fallback={<div className="h-16 border-b bg-background" />}
          >
            <DashboardHeader />
          </ClientOnly>
          <main
            className={
              isArtistBattleRoom
                ? "min-h-0 flex-1 overflow-hidden"
                : "flex-1 p-4 pb-32 md:p-6 md:pb-28"
            }
          >
            <Outlet />
          </main>
        </div>
      </div>
      <MobileNav />
    </SidebarProvider>
  );
}
