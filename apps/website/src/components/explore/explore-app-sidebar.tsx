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
  Swords,
  PartyPopper,
  Tags,
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

import { useMeQuery } from "@/lib/soundkit-api-hooks";

const discoverLinks: SidebarNavItem[] = [
  { href: "/", icon: MapPin, label: "Home" },
  { href: "/tracks", icon: Music, label: "Songs" },
  { href: "/videos", icon: Video, label: "Videos" },
  { href: "/artist", icon: Users, label: "Artists" },
  { href: "/genres", icon: Tags, label: "Genres" },
  { href: "/shop", icon: ShoppingBag, label: "Shop" },
].map(({ href, icon, label }) => ({ icon, title: label, url: href }));

const liveLinks: SidebarNavItem[] = [
  { href: "/live/battles", icon: Swords, label: "Battles" },
  { href: "/live/parties", icon: PartyPopper, label: "Parties" },
  { href: "/live/streams", icon: TvMinimalPlay, label: "Streams" },
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
  const meQuery = useMeQuery();
  const isSignedIn = Boolean(meQuery.data);

  const isRouteActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  const resolvedDiscoverLinks = discoverLinks.map((item) => ({
    ...item,
    isActive: isRouteActive(item.url ?? "/"),
  }));

  const resolvedLiveLinks = liveLinks.map((item) => ({
    ...item,
    isActive: isRouteActive(item.url ?? "/live"),
  }));

  const resolvedLibraryLinks = libraryLinks.map((item) => ({
    ...item,
    isActive: isRouteActive(item.url ?? "/library"),
    url: isSignedIn ? item.url : `/login?redirect=${encodeURIComponent(item.url ?? "/library")}`,
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
        <SidebarNavGroup label="Live" items={resolvedLiveLinks} />
        <SidebarNavGroup label="My SoundKit" items={resolvedLibraryLinks} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
