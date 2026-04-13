import { Outlet, createFileRoute } from '@tanstack/react-router'
import { SidebarProvider } from '@/components/ui/sidebar'
import { ExploreAppSidebar } from '@/components/explore/explore-app-sidebar'
import { ExploreHeader } from '@/components/explore/explore-header'
import { ExploreMobileNav } from '@/components/explore/explore-mobile-nav'
import { MusicPlayer } from '@/components/explore/music-player'

export const Route = createFileRoute('/_explore')({
  component: ExploreLayout,
})

function ExploreLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full overflow-hidden">
        <ExploreAppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <ExploreHeader />
          <main className="flex-1 pb-32 lg:pb-28 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <ExploreMobileNav />
      <MusicPlayer />
    </SidebarProvider>
  )
}
