
import { Link } from "@tanstack/react-router"
import { useRouterState } from "@tanstack/react-router"
import { MapPin, Trophy, Users, Music, Clock, Heart, ShoppingBag, Settings } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const discoverLinks = [
  { href: "/", label: "Home", icon: MapPin },
  { href: "/tracks", label: "Songs", icon: Music },
  { href: "/artist", label: "Artists", icon: Users },
  { href: "/battles", label: "Live Battles", icon: Trophy },
  { href: "/genres", label: "Genres", icon: Music },
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

export function ExploreAppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Music className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">SoundKit</span>
                  <span className="text-xs text-muted-foreground">Discover Music</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Discover</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {discoverLinks.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label}>
                    <Link to={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>My SoundKit</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {libraryLinks.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label}>
                    <Link to={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
