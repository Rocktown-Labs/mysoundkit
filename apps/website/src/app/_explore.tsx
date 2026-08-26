/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp, prefer-named-capture-group */
import {
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router";

import { ExploreAppSidebar } from "@/components/explore/explore-app-sidebar";
import { ExploreHeader } from "@/components/explore/explore-header";
import { ExploreMobileNav } from "@/components/explore/explore-mobile-nav";
import { SidebarProvider } from "@/components/ui/sidebar";
import { isImmersiveExploreRoute } from "@/lib/immersive-route";

export const Route = createFileRoute("/_explore")({
  component: ExploreLayout,
});

function ExploreLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname }),
    isImmersive = isImmersiveExploreRoute(pathname);

  return (
    <SidebarProvider defaultOpen={true}>
      <div
        className={`public-pages flex w-full overflow-hidden ${
          isImmersive ? "h-svh max-h-svh" : "min-h-screen"
        }`}
      >
        <ExploreAppSidebar />
        <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden">
          <ExploreHeader />
          <main
            className={
              isImmersive
                ? "min-h-0 flex-1 overflow-hidden pb-0"
                : "flex-1 pb-32 lg:pb-28 overflow-auto"
            }
          >
            <Outlet />
          </main>
        </div>
      </div>
      <ExploreMobileNav />
    </SidebarProvider>
  );
}
