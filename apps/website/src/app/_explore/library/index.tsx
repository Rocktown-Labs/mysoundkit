import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Clock,
  Heart,
  Music,
  ShoppingBag,
  ListMusic,
  Settings,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLibraryOverviewQuery } from "@/lib/soundkit-api-hooks";
import type { LibraryOverview } from "@/lib/soundkit-api-hooks";

const libraryCategories = [
  {
    color: "text-blue-500",
    countKey: "recentPlayCount",
    description: "Your listening history",
    href: "/library/recent",
    icon: Clock,
    title: "Recently Played",
  },
  {
    color: "text-purple-500",
    countKey: "playlistCount",
    description: "Your custom playlists",
    href: "/library/playlists",
    icon: ListMusic,
    title: "Playlists",
  },
  {
    color: "text-red-500",
    countKey: "savedTrackCount",
    description: "Songs you've favorited",
    href: "/library/saved",
    icon: Heart,
    title: "Saved Tracks",
  },
  {
    color: "text-green-500",
    countKey: "purchaseCount",
    description: "Tracks you own",
    href: "/library/purchased",
    icon: ShoppingBag,
    title: "Purchased",
  },
  {
    color: "text-cyan-500",
    countKey: "watchedCount",
    description: "Watch again or resume",
    href: "/library/watched",
    icon: Video,
    title: "Recently Watched",
  },
  {
    color: "text-muted-foreground",
    countKey: null,
    description: "Manage your settings",
    href: "/library/settings",
    icon: Settings,
    title: "Account",
  },
] as const satisfies readonly {
  countKey: keyof LibraryOverview | null;
  [key: string]: unknown;
}[];

export const Route = createFileRoute("/_explore/library/")({
  component: LibraryPage,
});

function LibraryPage() {
  const { data: overview } = useLibraryOverviewQuery();

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 flex items-center gap-3">
          <Music className="size-8 text-primary" />
          My SoundKit
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Access your music collection, playlists, and listening history
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {libraryCategories.map((category) => {
          const Icon = category.icon,
            count =
              category.countKey && overview
                ? (overview[category.countKey] ?? 0)
                : null;

          return (
            <Link key={category.href} to={category.href}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader className="p-4 md:p-6">
                  <div className="flex flex-col items-center text-center md:items-start md:text-left gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-muted">
                      <Icon className={`size-6 ${category.color}`} />
                    </div>
                    <CardTitle className="text-lg md:text-xl">
                      {category.title}
                    </CardTitle>
                  </div>
                  <CardDescription className="hidden md:block text-base">
                    {count === null
                      ? category.description
                      : `${count.toLocaleString()} ${category.description.toLowerCase()}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="hidden md:block">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-primary"
                  >
                    View {category.title}
                    <Music className="ml-auto size-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
