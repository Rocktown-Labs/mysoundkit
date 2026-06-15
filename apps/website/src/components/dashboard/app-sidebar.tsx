import { Link } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import {
  Home,
  Music,
  Film,
  FolderOpen,
  MessageSquare,
  Users,
  Settings,
  User,
  BarChart3,
  Sparkles,
  Trophy,
  Radio,
  Headphones,
  Mic2,
} from "lucide-react";

import { SidebarNavGroup } from "@/components/sidebar-nav-group";
import type { SidebarNavItem } from "@/components/sidebar-nav-group";
import { SoundKitBrand } from "@/components/soundkit-brand";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const myMusicNavigation: SidebarNavItem[] = [
  { href: "/dashboard", icon: Home, name: "Dashboard" },
  { href: "/dashboard/tracks", icon: Music, name: "Tracks" },
  { href: "/dashboard/projects", icon: FolderOpen, name: "Projects" },
  { href: "/dashboard/videos", icon: Film, name: "Videos" },
  { href: "/dashboard/open-verses", icon: Mic2, name: "Open Verses" },
  { href: "/dashboard/messages", icon: MessageSquare, name: "Messages" },
  { href: "/dashboard/team", icon: Users, name: "Team" },
].map(({ href, icon, name }) => ({ icon, title: name, url: href }));

const careerNavigation: SidebarNavItem[] = [
  { href: "/dashboard/career/profile", icon: User, name: "Profile" },
  { href: "/dashboard/career/analytics", icon: BarChart3, name: "Analytics" },
  { href: "/dashboard/career/ai-studio", icon: Sparkles, name: "AI Studio" },
  { href: "/dashboard/career/settings", icon: Settings, name: "Settings" },
].map(({ href, icon, name }) => ({ icon, title: name, url: href }));

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLiveRoute = pathname.startsWith("/dashboard/live");
  const isBattleLiveRoute =
    isLiveRoute &&
    !pathname.startsWith("/dashboard/live/parties") &&
    !pathname.startsWith("/dashboard/live/streams");

  const isRouteActive = (href: string) =>
    href === "/dashboard"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  const resolvedMyMusicNavigation = myMusicNavigation.map((item) => ({
    ...item,
    isActive: isRouteActive(item.url ?? "/dashboard"),
  }));

  const resolvedCareerNavigation = careerNavigation.map((item) => ({
    ...item,
    isActive: isRouteActive(item.url ?? "/dashboard"),
  }));

  const liveNavigation: SidebarNavItem[] = [
    {
      icon: Trophy,
      isActive: isLiveRoute,
      items: [
        {
          isActive: isBattleLiveRoute,
          title: "Battles",
          url: "/dashboard/live",
        },
        {
          isActive: isRouteActive("/dashboard/live/parties"),
          title: "Parties",
          url: "/dashboard/live/parties",
        },
        {
          isActive: isRouteActive("/dashboard/live/streams"),
          title: "Streams",
          url: "/dashboard/live/streams",
        },
      ],
      title: "Live",
      url: "/dashboard/live",
    },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/dashboard">
                <SoundKitBrand />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNavGroup label="My Music" items={resolvedMyMusicNavigation} />
        <SidebarNavGroup label="My Career" items={resolvedCareerNavigation} />
        <SidebarNavGroup label="Live" items={liveNavigation} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="size-8">
                    <AvatarImage src="/diverse-user-avatars.png" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold">John Doe</span>
                    <span className="text-xs text-muted-foreground">
                      john@example.com
                    </span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/profile">
                    <User className="mr-2 size-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/career/settings">
                    <Settings className="mr-2 size-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/">
                    <Music className="mr-2 size-4" />
                    Explore Music
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
