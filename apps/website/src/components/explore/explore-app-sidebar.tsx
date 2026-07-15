import { Link, useRouterState } from "@tanstack/react-router";
import {
  MapPin,
  Users,
  Music,
  Video,
  Heart,
  ShoppingBag,
  Settings,
  ListMusic,
  ListVideo,
  ListPlus,
  TvMinimalPlay,
} from "lucide-react";

import { SidebarNavGroup } from "@/components/sidebar-nav-group";
import type { SidebarNavItem } from "@/components/sidebar-nav-group";
import { SoundKitBrand } from "@/components/soundkit-brand";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const discoverLinks: SidebarNavItem[] = [
  { href: "/", icon: MapPin, label: "Home" },
  { href: "/tracks", icon: Music, label: "Songs" },
  { href: "/videos", icon: Video, label: "Videos" },
  { href: "/artist", icon: Users, label: "Artists" },
  { href: "/shop", icon: ShoppingBag, label: "Shop" },
  { href: "/genres", icon: Music, label: "Genres" },
].map(({ href, icon, label }) => ({ icon, title: label, url: href }));

const libraryLinks: SidebarNavItem[] = [
  { href: "/library/recent", icon: ListMusic, label: "Recently Played" },
  { href: "/library/watched", icon: ListVideo, label: "Recently Watched" },
  { href: "/library/playlists", icon: ListPlus, label: "Playlists" },
  { href: "/library/saved", icon: Heart, label: "Saved Tracks" },
  { href: "/library/purchased", icon: ShoppingBag, label: "Purchased" },
  { href: "/library/settings", icon: Settings, label: "Account" },
].map(({ href, icon, label }) => ({ icon, title: label, url: href }));

export function ExploreAppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isRouteActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);
  const isLiveRoute = pathname.startsWith("/live");

  const resolvedDiscoverLinks: SidebarNavItem[] = [
    ...discoverLinks.slice(0, 3).map((item) => ({
      ...item,
      isActive: isRouteActive(item.url ?? "/"),
    })),
    {
      ...discoverLinks[3],
      isActive: isRouteActive(discoverLinks[3]?.url ?? "/artist"),
    },
    {
      ...discoverLinks[4],
      isActive: isRouteActive(discoverLinks[4]?.url ?? "/shop"),
    },
    {
      icon: TvMinimalPlay,
      isActive: isLiveRoute,
      items: [
        {
          isActive: isRouteActive("/live/battles"),
          title: "Battles",
          url: "/live/battles",
        },
        {
          isActive: isRouteActive("/live/parties"),
          title: "Parties",
          url: "/live/parties",
        },
        {
          isActive: isRouteActive("/live/streams"),
          title: "Streams",
          url: "/live/streams",
        },
      ],
      title: "Live",
      url: "/live",
    },
    {
      ...discoverLinks[5],
      isActive: isRouteActive(discoverLinks[5]?.url ?? "/genres"),
    },
  ];

  const resolvedLibraryLinks = libraryLinks.map((item) => ({
    ...item,
    isActive: isRouteActive(item.url ?? "/library"),
  }));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <SoundKitBrand />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNavGroup label="Discover" items={resolvedDiscoverLinks} />
        <SidebarNavGroup label="My SoundKit" items={resolvedLibraryLinks} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
