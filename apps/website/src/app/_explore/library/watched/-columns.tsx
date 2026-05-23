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
  type: "battle" | "video" | "stream";
  thumbnail: string;
  creator: string;
  creatorSlug: string;
  duration: string;
  watchedAt: string;
}

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
      const Icon = row.original.type === "battle" ? Sword : Video;
      return (
        <div className="flex flex-col gap-1">
          <Link
            to={row.original.type === "battle" ? "/battles/$id" : "/videos/$id"}
            params={{ id: row.original.id }}
            className="font-medium hover:text-primary transition-colors line-clamp-1"
          >
            {row.getValue("title")}
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
            <Icon className="size-3" />
            {row.original.type}
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
            <Link
              to={
                row.original.type === "battle" ? "/battles/$id" : "/videos/$id"
              }
              params={{ id: row.original.id }}
            >
              Watch Again
            </Link>
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
