import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Play, MoreVertical, Video, Sword } from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface WatchedItem {
  id: string;
  title: string;
  type: "battle" | "community" | "party" | "stream" | "video";
  thumbnail: string;
  creator: string;
  creatorSlug: string;
  duration: string;
  watchedAt: string;
  regionSlug?: string | null;
  slug?: string | null;
}

const watchedItemLabel = (type: WatchedItem["type"]) => {
  if (type === "party") {
    return "listening party";
  }

  return type;
};

const watchedItemIcon = (type: WatchedItem["type"]) => {
  if (type === "battle") {
    return Sword;
  }

  return Video;
};

export const columns: ColumnDef<WatchedItem>[] = [
  {
    accessorKey: "thumbnail",
    cell: ({ row }) => (
      <div className="relative size-16 flex-shrink-0 group">
        <AppImage
          src={row.getValue("thumbnail") || "/placeholder.svg"}
          alt={row.original.title}
          width={64}
          height={64}
          layout="fixed"
          className="size-full rounded object-cover"
        />
        <button className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="size-5 text-white fill-white" />
        </button>
      </div>
    ),
    enableHiding: false,
    enableSorting: false,
    header: "Preview",
  },
  {
    accessorKey: "title",
    cell: ({ row }) => {
      const Icon = watchedItemIcon(row.original.type);
      const title = row.getValue<string>("title");
      const item = row.original;
      const linkClassName =
        "font-medium hover:text-primary transition-colors line-clamp-1";

      const titleLink =
        item.type === "battle" ? (
          <Link
            to="/live/battles/$id"
            params={{ id: item.id }}
            className={linkClassName}
          >
            {title}
          </Link>
        ) : item.type === "stream" ? (
          <Link
            to="/live/streams/$id"
            params={{ id: item.id }}
            className={linkClassName}
          >
            {title}
          </Link>
        ) : item.type === "party" ? (
          <Link
            to="/live/parties/$id"
            params={{ id: item.id }}
            className={linkClassName}
          >
            {title}
          </Link>
        ) : item.type === "community" ? (
          <Link to="/communities" className={linkClassName}>
            {title}
          </Link>
        ) : (
          <Link
            params={
              item.regionSlug && item.slug
                ? { regionSlug: item.regionSlug, slug: item.slug }
                : { id: item.id }
            }
            to={
              item.regionSlug && item.slug
                ? "/videos/$regionSlug/$slug"
                : "/videos/$id"
            }
            className={linkClassName}
          >
            {title}
          </Link>
        );

      return (
        <div className="flex flex-col gap-1">
          {titleLink}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
            <Icon className="size-3" />
            {watchedItemLabel(row.original.type)}
          </div>
        </div>
      );
    },
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Title
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "creator",
    cell: ({ row }) => (
      <Link
        to="/artist/$username"
        params={{ username: row.original.creatorSlug }}
        className="hover:text-primary transition-colors"
      >
        {row.getValue("creator")}
      </Link>
    ),
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Creator
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "duration",
    header: "Duration",
  },
  {
    accessorKey: "watchedAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Last Watched
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            {row.original.type === "battle" ? (
              <Link to="/live/battles/$id" params={{ id: row.original.id }}>
                Watch Again
              </Link>
            ) : row.original.type === "stream" ? (
              <Link to="/live/streams/$id" params={{ id: row.original.id }}>
                Watch Again
              </Link>
            ) : row.original.type === "party" ? (
              <Link to="/live/parties/$id" params={{ id: row.original.id }}>
                Watch Again
              </Link>
            ) : row.original.type === "community" ? (
              <Link to="/communities">Open Community</Link>
            ) : (
              <Link
                params={
                  row.original.regionSlug && row.original.slug
                    ? {
                        regionSlug: row.original.regionSlug,
                        slug: row.original.slug,
                      }
                    : { id: row.original.id }
                }
                to={
                  row.original.regionSlug && row.original.slug
                    ? "/videos/$regionSlug/$slug"
                    : "/videos/$id"
                }
              >
                Watch Again
              </Link>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem>Share</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">
            Remove from History
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    id: "actions",
  },
];
