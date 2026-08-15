import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  Compass,
  Film,
  FolderOpen,
  Home,
  Landmark,
  Megaphone,
  MessageSquare,
  Mic2,
  Music,
  PartyPopper,
  Plus,
  Radio,
  Settings,
  Trophy,
  User,
  UserRoundPlus,
  Users,
  WalletCards,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DashboardMobileSection = "career" | "live" | "music";

interface DashboardMobileRoute {
  badge?: string;
  description: string;
  icon: typeof Music;
  name: string;
  to: string;
}

const sectionRoutes: Record<
  DashboardMobileSection,
  { icon: typeof Music; name: string; routes: DashboardMobileRoute[] }
> = {
  career: {
    icon: BarChart3,
    name: "Career",
    routes: [
      {
        description: "Public profile, links, and artist presence",
        icon: User,
        name: "Profile",
        to: "/dashboard/career/profile",
      },
      {
        description: "Private account profile and identity",
        icon: User,
        name: "Account Profile",
        to: "/dashboard/profile",
      },
      {
        description: "Track, project, and audience performance",
        icon: BarChart3,
        name: "Analytics",
        to: "/dashboard/career/analytics",
      },
      {
        description: "Release dates, promo tasks, and planning",
        icon: CalendarDays,
        name: "Calendar",
        to: "/dashboard/career/calendar",
      },
      {
        description: "Team members and workspace access",
        icon: Users,
        name: "Team",
        to: "/dashboard/team",
      },
      {
        description: "Campaigns, wallet, and audience targeting",
        icon: Megaphone,
        name: "Ads",
        to: "/dashboard/ads",
      },
      {
        description: "Community posts, fan movement, and updates",
        icon: Users,
        name: "Community",
        to: "/dashboard/community",
      },
      {
        description: "Revenue, payouts, and financial snapshot",
        icon: Landmark,
        name: "Finance",
        to: "/dashboard/finance",
      },
      {
        description: "Plan, subscription, and payment settings",
        icon: WalletCards,
        name: "Billing",
        to: "/dashboard/billing",
      },
      {
        description: "Account, notifications, and artist settings",
        icon: Settings,
        name: "Settings",
        to: "/dashboard/career/settings",
      },
    ],
  },
  live: {
    icon: Trophy,
    name: "Live",
    routes: [
      {
        description: "Battle requests, kits, and live matchups",
        icon: Trophy,
        name: "Battles",
        to: "/dashboard/live",
      },
      {
        description: "Find artists and rooms to battle",
        icon: Users,
        name: "Find",
        to: "/dashboard/live/find",
      },
      {
        description: "Respond to incoming battle challenges",
        icon: UserRoundPlus,
        name: "Challenges",
        to: "/dashboard/live/challenge",
      },
      {
        description: "Listening parties for releases and fans",
        icon: PartyPopper,
        name: "Parties",
        to: "/dashboard/live/parties",
      },
      {
        description: "Live stream setup and broadcast tools",
        icon: Radio,
        name: "Streams",
        to: "/dashboard/live/streams",
      },
      {
        description: "Scheduled live moments and reminders",
        icon: CalendarDays,
        name: "Upcoming",
        to: "/dashboard/live/upcoming",
      },
      {
        description: "Battle kits, format slots, and track picks",
        icon: Music,
        name: "My Kits",
        to: "/dashboard/live/my-kit",
      },
      {
        description: "Battle performance by track",
        icon: BarChart3,
        name: "My Stats",
        to: "/dashboard/live/my-stats",
      },
    ],
  },
  music: {
    icon: Music,
    name: "Music",
    routes: [
      {
        description: "Songs, masters, metadata, and files",
        icon: Music,
        name: "Tracks",
        to: "/dashboard/tracks",
      },
      {
        description: "Albums, EPs, mixtapes, and bundles",
        icon: FolderOpen,
        name: "Projects",
        to: "/dashboard/projects",
      },
      {
        description: "Music videos and visual releases",
        icon: Film,
        name: "Videos",
        to: "/dashboard/videos",
      },
      {
        description: "Open verse listings and submissions",
        icon: Mic2,
        name: "Open Verses",
        to: "/dashboard/open-verses",
      },
      {
        description: "Messages from artists, fans, and collaborators",
        icon: MessageSquare,
        name: "Messages",
        to: "/dashboard/messages",
      },
      {
        description: "Friends and collaboration requests",
        icon: UserRoundPlus,
        name: "Friends",
        to: "/dashboard/collaborators",
      },
    ],
  },
},

 createRoutes: DashboardMobileRoute[] = [
  {
    description: "Upload a song and its cover artwork",
    icon: Music,
    name: "New Track",
    to: "/dashboard/tracks/new",
  },
  {
    description: "Create an album, EP, or mixtape",
    icon: FolderOpen,
    name: "New Project",
    to: "/dashboard/projects/new",
  },
  {
    description: "Publish a music video",
    icon: Film,
    name: "New Video",
    to: "/dashboard/videos/new",
  },
  {
    description: "Start an open verse listing",
    icon: Mic2,
    name: "New Open Verse",
    to: "/dashboard/open-verses/new",
  },
  {
    description: "Return to the public SoundKit app",
    icon: Compass,
    name: "Explore Home",
    to: "/",
  },
],

 isSectionActive = (pathname: string, section: DashboardMobileSection) => {
  if (section === "music") {
    return [
      "/dashboard/tracks",
      "/dashboard/projects",
      "/dashboard/videos",
      "/dashboard/open-verses",
      "/dashboard/messages",
      "/dashboard/collaborators",
    ].some((path) => pathname.startsWith(path));
  }

  if (section === "career") {
    return (
      pathname.startsWith("/dashboard/career") ||
      pathname.startsWith("/dashboard/profile") ||
      pathname.startsWith("/dashboard/team") ||
      pathname.startsWith("/dashboard/ads") ||
      pathname.startsWith("/dashboard/community") ||
      pathname.startsWith("/dashboard/finance") ||
      pathname.startsWith("/dashboard/billing")
    );
  }

  return pathname.startsWith("/dashboard/live");
};

function RouteList({
  onSelect,
  routes,
}: {
  onSelect: () => void;
  routes: DashboardMobileRoute[];
}) {
  return (
    <div className="grid gap-2 py-3">
      {routes.map((route) => {
        const Icon = route.icon;
        return (
          <Link
            key={route.to}
            to={route.to}
            className="flex min-w-0 items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
            onClick={onSelect}
          >
            <Icon className="size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold text-sm">{route.name}</p>
                {route.badge && (
                  <Badge className="h-5 px-1.5 text-[10px]" variant="secondary">
                    {route.badge}
                  </Badge>
                )}
              </div>
              <p className="truncate text-muted-foreground text-xs">
                {route.description}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname }),
   [createOpen, setCreateOpen] = useState(false),
   [sectionOpen, setSectionOpen] = useState<DashboardMobileSection | null>(
    null
  ),
   activeSection = sectionOpen ? sectionRoutes[sectionOpen] : null;

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="grid h-16 grid-cols-5 items-center">
        <Link
          to="/dashboard"
          className={cn(
            "flex h-full flex-col items-center justify-center gap-1 text-xs transition-colors",
            pathname === "/dashboard"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Home className="size-5" />
          <span>Home</span>
        </Link>

        {(["music", "career"] as const).map((section) => {
          const Icon = sectionRoutes[section].icon,
           active = isSectionActive(pathname, section);
          return (
            <button
              key={section}
              className={cn(
                "flex h-full flex-col items-center justify-center gap-1 text-xs transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setSectionOpen(section)}
              type="button"
            >
              <Icon className="size-5" />
              <span>{sectionRoutes[section].name}</span>
            </button>
          );
        })}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild={true}>
            <button
              aria-label="Create New"
              className="flex h-full flex-col items-center justify-center gap-1 text-xs"
              type="button"
            >
              <div className="-mt-6 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                <Plus className="size-6" />
              </div>
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New</DialogTitle>
              <DialogDescription>
                Choose what you want to add to SoundKit.
              </DialogDescription>
            </DialogHeader>
            <RouteList
              routes={createRoutes}
              onSelect={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <button
          className={cn(
            "flex h-full flex-col items-center justify-center gap-1 text-xs transition-colors",
            isSectionActive(pathname, "live")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setSectionOpen("live")}
          type="button"
        >
          <Trophy className="size-5" />
          <span>Live</span>
        </button>
      </div>

      <Dialog
        open={sectionOpen !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSectionOpen(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeSection?.name ?? "Dashboard"}</DialogTitle>
            <DialogDescription>
              Jump to the dashboard tools in this section.
            </DialogDescription>
          </DialogHeader>
          {activeSection && (
            <RouteList
              routes={activeSection.routes}
              onSelect={() => setSectionOpen(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </nav>
  );
}
