import { Link, useRouterState } from "@tanstack/react-router";
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
  Megaphone,
  Trophy,
  Mic2,
  ShieldCheck,
  UserRoundPlus,
  CalendarDays,
  CircleDollarSign,
  Compass,
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
import { authClient } from "@/lib/auth-client";
import { useAdminAccessQuery } from "@/lib/soundkit-api-hooks";

const myMusicNavigation: SidebarNavItem[] = [
    { href: "/dashboard", icon: Home, name: "Dashboard" },
    { href: "/dashboard/tracks", icon: Music, name: "Tracks" },
    { href: "/dashboard/projects", icon: FolderOpen, name: "Projects" },
    { href: "/dashboard/videos", icon: Film, name: "Videos" },
    { href: "/dashboard/open-verses", icon: Mic2, name: "Open Verses" },
    { href: "/dashboard/messages", icon: MessageSquare, name: "Messages" },
    { href: "/dashboard/collaborators", icon: UserRoundPlus, name: "Network" },
  ].map(({ href, icon, name }) => ({ icon, title: name, url: href })),
  careerNavigation: SidebarNavItem[] = [
    { href: "/dashboard/career/profile", icon: User, name: "Profile" },
    { href: "/dashboard/career/analytics", icon: BarChart3, name: "Analytics" },
    {
      href: "/dashboard/career/calendar",
      icon: CalendarDays,
      name: "Calendar",
    },
    { href: "/dashboard/team", icon: Users, name: "Workspace" },
    { href: "/dashboard/ads", icon: Megaphone, name: "Ads" },
    { href: "/dashboard/career/settings", icon: Settings, name: "Settings" },
    {
      href: "/dashboard/career/payments",
      icon: CircleDollarSign,
      name: "Payments",
    },
  ].map(({ href, icon, name }) => ({ icon, title: name, url: href }));

export function AppSidebar() {
  const { data: session } = authClient.useSession(),
    adminAccess = useAdminAccessQuery(Boolean(session?.user)),
    pathname = useRouterState({ select: (s) => s.location.pathname }),
    isAdmin =
      session?.user.role
        ?.split(",")
        .map((role) => role.trim())
        .includes("admin") || adminAccess.data?.isAdmin,
    isRouteActive = (href: string) =>
      href === "/dashboard"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    resolvedMyMusicNavigation = myMusicNavigation.map((item) => ({
      ...item,
      isActive: isRouteActive(item.url ?? "/dashboard"),
    })),
    resolvedCareerNavigation = careerNavigation.map((item) => ({
      ...item,
      isActive: isRouteActive(item.url ?? "/dashboard"),
    })),
    liveNavigation: SidebarNavItem[] = [
      {
        icon: Trophy,
        isActive: pathname === "/dashboard/live",
        title: "Battles",
        url: "/dashboard/live",
      },
      {
        icon: Users,
        isActive: isRouteActive("/dashboard/live/parties"),
        title: "Parties",
        url: "/dashboard/live/parties",
      },
      {
        icon: Film,
        isActive: isRouteActive("/dashboard/live/streams"),
        title: "Streams",
        url: "/dashboard/live/streams",
      },
      {
        icon: Music,
        isActive: isRouteActive("/dashboard/live/my-kit"),
        title: "My Kits",
        url: "/dashboard/live/my-kit",
      },
      {
        icon: BarChart3,
        isActive: isRouteActive("/dashboard/live/my-stats"),
        title: "My Stats",
        url: "/dashboard/live/my-stats",
      },
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
        <SidebarNavGroup label="My Music" items={resolvedMyMusicNavigation} />
        <SidebarNavGroup label="My Career" items={resolvedCareerNavigation} />
        <SidebarNavGroup label="Live" items={liveNavigation} />
        {isAdmin && (
          <SidebarNavGroup
            label="Administration"
            items={[
              {
                icon: ShieldCheck,
                isActive: isRouteActive("/dashboard/admin"),
                title: "Admin",
                url: "/dashboard/admin",
              },
            ]}
          />
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/">
                <Compass />
                <span>Back to App Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="size-8">
                    <AvatarImage src="/placeholder-user.jpg" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold">
                      {session?.user.name ?? "SoundKit User"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {session?.user.email ?? "Signed in"}
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
                <DropdownMenuItem
                  onSelect={() => {
                    void authClient.signOut({
                      fetchOptions: {
                        onSuccess: () => window.location.assign("/"),
                      },
                    });
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
