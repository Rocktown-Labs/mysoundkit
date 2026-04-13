import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Play, Trash2 } from "lucide-react"
import { AppImage } from "@/components/ui/app-image"
import { Button } from "@/components/ui/button"

import { Link } from "@tanstack/react-router"

export type PlaylistTrack = {
  id: string
  title: string
  artist: string
  artistSlug: string
  cover: string
  duration: string
  addedAt: string
}

export const columns: ColumnDef<PlaylistTrack>[] = [
  {
    accessorKey: "cover",
    header: "Cover",
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
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Song Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <Link to={`/tracks/${row.original.id}`} className="font-medium hover:text-primary">
        {row.getValue("title")}
      </Link>
    ),
  },
  {
    accessorKey: "artist",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Artist
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <Link to={`/artist/${row.original.artistSlug}`} className="hover:text-primary">
        {row.getValue("artist")}
      </Link>
    ),
  },
  {
    accessorKey: "duration",
    header: "Duration",
  },
  {
    accessorKey: "addedAt",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Date Added
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return (
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      )
    },
  },
]
