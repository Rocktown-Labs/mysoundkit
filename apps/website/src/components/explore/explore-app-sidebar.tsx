import { Link, useRouterState } from "@tanstack/react-router";
import {
  Disc,
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
    { href: "/projects", icon: Disc, label: "Projects" },
    { href: "/videos", icon: Video, label: "Videos" },
    { href: "/artist", icon: Users, label: "Artists" },
    { href: "/genres", icon: Tags, label: "Genres" },
    { href: "/shop", icon: ShoppingBag, label: "Shop" },
  ].map(({ href, icon, label }) => ({ icon, title: label, url: href })),
  liveLinks: SidebarNavItem[] = [
    { href: "/live/battles", icon: Swords, label: "Battles" },
    { href: "/live/parties", icon: PartyPopper, label: "Parties" },
    { href: "/live/streams", icon: TvMinimalPlay, label: "Streams" },
  ].map(({ href, icon, label }) => ({ icon, title: label, url: href })),
  libraryLinks: SidebarNavItem[] = [
    { href: "/library/recent", icon: ListMusic, label: "Recently Played" },
    { href: "/library/watched", icon: ListVideo, label: "Recently Watched" },
    { href: "/library/playlists", icon: ListPlus, label: "Playlists" },
    { href: "/library/saved", icon: Heart, label: "Saved Tracks" },
    { href: "/library/purchased", icon: ShoppingBag, label: "Purchased" },
    { href: "/library/settings", icon: Settings, label: "Account" },
  ].map(({ href, icon, label }) => ({ icon, title: label, url: href }));

export function ExploreAppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname }),
    meQuery = useMeQuery(),
    isSignedIn = Boolean(meQuery.data),
    isRouteActive = (href: string) =>
      href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(`${href}/`),
    resolvedDiscoverLinks = discoverLinks.map((item) => ({
      ...item,
      isActive: isRouteActive(item.url ?? "/"),
    })),
    resolvedLiveLinks = liveLinks.map((item) => ({
      ...item,
      isActive: isRouteActive(item.url ?? "/live"),
    })),
    profileLink: SidebarNavItem | null = meQuery.data
      ? {
          icon: Users,
          isActive:
            meQuery.data.user.accountType === "artist"
              ? pathname.startsWith("/dashboard")
              : pathname.startsWith("/people/"),
          title:
            meQuery.data.user.accountType === "artist"
              ? "Artist Dashboard"
              : "My Fan Profile",
          url:
            meQuery.data.user.accountType === "artist"
              ? "/dashboard"
              : `/people/${meQuery.data.user.username}`,
        }
      : null,
    baseLibraryLinks = libraryLinks
      .filter((item) => item.url !== "/library/settings")
      .map((item) => ({
        ...item,
        isActive: isRouteActive(item.url ?? "/library"),
        url: isSignedIn
          ? item.url
          : `/login?redirect=${encodeURIComponent(item.url ?? "/library")}`,
      })),
    settingsItem: SidebarNavItem = {
      icon: Settings,
      isActive: isRouteActive("/library/settings"),
      title: "Settings",
      url: isSignedIn
        ? "/library/settings"
        : `/login?redirect=${encodeURIComponent("/library/settings")}`,
    },
    resolvedLibraryLinks = [
      ...baseLibraryLinks,
      ...(profileLink ? [profileLink] : []),
      settingsItem,
    ];

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
