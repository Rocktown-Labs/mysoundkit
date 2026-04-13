
import { Link } from "@tanstack/react-router"
import { useRouterState } from "@tanstack/react-router"
import {
  Home,
  Music,
  FolderOpen,
  MessageSquare,
  Users,
  Settings,
  User,
  BarChart3,
  Sparkles,
  Trophy,
  Swords,
  Calendar,
  SearchIcon,
  Target,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const myMusicNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Tracks", href: "/dashboard/tracks", icon: Music },
  { name: "Projects", href: "/dashboard/projects", icon: FolderOpen },
  { name: "Messages", href: "/dashboard/messages", icon: MessageSquare },
  { name: "Team", href: "/dashboard/team", icon: Users },
]

const careerNavigation = [
  { name: "Profile", href: "/dashboard/career/profile", icon: User },
  { name: "Analytics", href: "/dashboard/career/analytics", icon: BarChart3 },
  { name: "AI Studio", href: "/dashboard/career/ai-studio", icon: Sparkles },
  { name: "Settings", href: "/dashboard/career/settings", icon: Settings },
]

const battleHubNavigation = [
  { name: "Home", href: "/dashboard/battles", icon: Trophy },
  { name: "Find Battle", href: "/dashboard/battles/find", icon: SearchIcon },
  { name: "Upcoming", href: "/dashboard/battles/upcoming", icon: Calendar },
  { name: "My Kit", href: "/dashboard/battles/my-kit", icon: Target },
  { name: "Challenge", href: "/dashboard/battles/challenge", icon: Swords },
  { name: "My Stats", href: "/dashboard/battles/my-stats", icon: BarChart3 },
]

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Music className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">SoundKit</span>
                  <span className="text-xs text-muted-foreground">Music Platform</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>My Music</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {myMusicNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.name}>
                    <Link to={item.href}>
                      <item.icon />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>My Career</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {careerNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.name}>
                    <Link to={item.href}>
                      <item.icon />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Battle Hub</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {battleHubNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.name}>
                    <Link to={item.href}>
                      <item.icon />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
                    <span className="text-xs text-muted-foreground">john@example.com</span>
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
                  <Link to="/dashboard/settings">
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
  )
}
