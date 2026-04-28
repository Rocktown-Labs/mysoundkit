import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Play } from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
import { Button } from "@/components/ui/button";

export interface RecentTrack {
  id: string;
  title: string;
  artist: string;
  artistSlug: string;
  cover: string;
  duration: string;
  timesPlayed: number;
  lastPlayed: string;
}

export const columns: ColumnDef<RecentTrack>[] = [
  {
    accessorKey: "cover",
    cell: ({ row }) => (
      <div className="relative size-12 flex-shrink-0 group">
        <AppImage
          src={row.getValue("cover") || "/placeholder.svg"}
          alt={row.original.title}
          width={48}
          height={48}
          layout="fixed"
          className="size-full rounded object-cover"
        />
        <button className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="size-4 text-white fill-white" />
        </button>
      </div>
    ),
    enableHiding: false,
    enableSorting: false,
    header: "Cover",
  },
  {
    accessorKey: "title",
    cell: ({ row }) => (
      <Link
        to="/tracks/$id"
        params={{ id: row.original.id }}
        className="font-medium hover:text-primary"
      >
        {row.getValue("title")}
      </Link>
    ),
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Song Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "artist",
    cell: ({ row }) => (
      <Link
        to="/artist/$username"
        params={{ username: row.original.artistSlug }}
        className="hover:text-primary"
      >
        {row.getValue("artist")}
      </Link>
    ),
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Artist
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "timesPlayed",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Times Played
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "lastPlayed",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Last Played
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "duration",
    header: "Duration",
  },
];
