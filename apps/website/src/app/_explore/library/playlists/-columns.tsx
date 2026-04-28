import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Music, MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackCount: number;
}

export const columns: ColumnDef<Playlist>[] = [
  {
    accessorKey: "icon",
    cell: () => (
      <div className="flex size-10 items-center justify-center rounded bg-muted">
        <Music className="size-5 text-primary" />
      </div>
    ),
    enableHiding: false,
    enableSorting: false,
    header: "",
  },
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <Link
        to="/library/playlists/$id"
        params={{ id: row.original.id }}
        className="font-medium hover:text-primary transition-colors"
      >
        {row.getValue("name")}
      </Link>
    ),
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Playlist Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "description",
    cell: ({ row }) => (
      <div className="max-w-[300px] truncate text-muted-foreground">
        {row.getValue("description")}
      </div>
    ),
    header: "Description",
  },
  {
    accessorKey: "trackCount",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Tracks
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
            <Link to="/library/playlists/$id" params={{ id: row.original.id }}>
              View Playlist
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>Edit Details</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">
            Delete Playlist
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    id: "actions",
  },
];
