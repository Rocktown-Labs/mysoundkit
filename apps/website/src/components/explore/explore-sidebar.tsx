
import { MapPin, Trophy, Users, Music, Clock, Heart, ShoppingBag, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Link } from "@tanstack/react-router"
import { useRouterState } from "@tanstack/react-router"
import { Separator } from "@/components/ui/separator"

const discoverLinks = [
  { href: "/", label: "Home", icon: MapPin },
  { href: "/tracks", label: "Songs", icon: Music },
  { href: "/artist", label: "Artists", icon: Users },
  { href: "/battles", label: "Live Battles", icon: Trophy },
]

const libraryLinks = [
  { href: "/library/recent", label: "Recently Played", icon: Clock },
  { href: "/library/playlists", label: "Playlists", icon: Music },
  { href: "/library/saved", label: "Saved Tracks", icon: Heart },
  { href: "/library/purchased", label: "Purchased", icon: ShoppingBag },
  { href: "/library/settings", label: "Account", icon: Settings },
]

const genres = [
  { id: "hip-hop", name: "Hip-Hop" },
  { id: "rb-soul", name: "R&B/Soul" },
  { id: "electronic", name: "Electronic" },
  { id: "pop", name: "Pop" },
  { id: "rock", name: "Rock" },
  { id: "jazz", name: "Jazz" },
  { id: "afrobeats", name: "Afrobeats" },
  { id: "latin", name: "Latin" },
  { id: "country", name: "Country" },
  { id: "reggae", name: "Reggae" },
  { id: "indie", name: "Indie" },
  { id: "metal", name: "Metal" },
]

export function ExploreSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <aside className="hidden lg:flex w-64 border-r bg-muted/10 min-h-screen flex-col gap-4 p-6 sticky top-14 lg:top-16 h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-4rem)] overflow-y-auto">
      <div>
        <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">Discover</h3>
        <nav className="space-y-1">
          {discoverLinks.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href

            return (
              <Link key={link.href} to={link.href}>
                <Button variant={isActive ? "secondary" : "ghost"} className="w-full justify-start">
                  <Icon className="mr-2 size-4" />
                  {link.label}
                </Button>
              </Link>
            )
          })}
        </nav>
      </div>

      <Separator />

      <div>
        <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">My SoundKit</h3>
        <nav className="space-y-1">
          {libraryLinks.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href

            return (
              <Link key={link.href} to={link.href}>
                <Button variant={isActive ? "secondary" : "ghost"} className="w-full justify-start">
                  <Icon className="mr-2 size-4" />
                  {link.label}
                </Button>
              </Link>
            )
          })}
        </nav>
      </div>

      <Separator />

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Genres</h3>
          <Link to="/genres">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View All
            </Button>
          </Link>
        </div>
        <nav className="space-y-1">
          {genres.map((genre) => {
            const isActive = pathname === `/genres/${genre.id}`

            return (
              <Link key={genre.id} to={`/genres/${genre.id}`}>
                <Button variant={isActive ? "secondary" : "ghost"} size="sm" className="w-full justify-start text-sm">
                  <Music className="mr-2 size-3" />
                  {genre.name}
                </Button>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
