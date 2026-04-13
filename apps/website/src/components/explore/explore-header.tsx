
import { Search } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Link } from "@tanstack/react-router"
import { useRouterState } from "@tanstack/react-router"
import { Suspense } from "react"

export function ExploreHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const getSearchPlaceholder = () => {
    if (pathname.startsWith("/artist")) {
      return "Search artists..."
    } else if (pathname.startsWith("/battles")) {
      return "Search battles..."
    } else if (pathname.startsWith("/tracks")) {
      return "Search songs..."
    } else if (pathname.startsWith("/genres")) {
      return "Search genres..."
    }
    return "Search artists, tracks, battles..."
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 md:h-16 items-center gap-2 md:gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <SidebarTrigger className="shrink-0" />

      <div className="flex-1 flex items-center justify-center max-w-3xl mx-auto">
        <div className="relative w-full max-w-md md:max-w-lg">
          <Suspense fallback={<div>Loading...</div>}>
            <Search className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={getSearchPlaceholder()}
              className="pl-8 md:pl-10 w-full h-9 md:h-10 text-sm"
            />
          </Suspense>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0 ml-auto">
        <Link to="/login">
          <Button variant="ghost" size="sm">
            Log In
          </Button>
        </Link>
        <Link to="/signup">
          <Button size="sm">Sign Up</Button>
        </Link>
      </div>
    </header>
  )
}
