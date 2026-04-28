import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { MusicPlayer } from "@/components/explore/music-player";
import { SidebarProvider } from "@/components/ui/sidebar";
import { requireDashboardUser } from "@/lib/soundkit.functions";

/* eslint-disable no-use-before-define */
export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => requireDashboardUser(),
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <DashboardHeader />
          <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileNav />
      <MusicPlayer />
    </SidebarProvider>
  );
}
