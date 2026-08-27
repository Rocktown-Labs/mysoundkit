import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface BattleStats {
  trackId: string;
  trackName: string;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  saves: number;
  downloads: number;
  purchases: number;
}

export const columns: ColumnDef<BattleStats>[] = [
  {
    accessorKey: "trackName",
    cell: ({ row }) => (
      <Link
        to="/dashboard/live/my-stats/$trackId"
        params={{ trackId: row.original.trackId }}
        className="font-medium text-primary hover:underline"
      >
        {row.getValue("trackName")}
      </Link>
    ),
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Track Name
        <ArrowUpDown className="ml-2 size-4" />
      </Button>
    ),
  },
  {
    accessorKey: "wins",
    cell: ({ row }) => (
      <div className="text-green-600 font-semibold">{row.getValue("wins")}</div>
    ),
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Wins
        <ArrowUpDown className="ml-2 size-4" />
      </Button>
    ),
  },
  {
    accessorKey: "losses",
    cell: ({ row }) => (
      <div className="text-red-600 font-semibold">{row.getValue("losses")}</div>
    ),
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Losses
        <ArrowUpDown className="ml-2 size-4" />
      </Button>
    ),
  },
  {
    accessorKey: "ties",
    cell: ({ row }) => (
      <div className="font-semibold text-amber-500">{row.getValue("ties")}</div>
    ),
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Ties
        <ArrowUpDown className="ml-2 size-4" />
      </Button>
    ),
  },
  {
    accessorKey: "winRate",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("winRate")}%</div>
    ),
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Win Rate
        <ArrowUpDown className="ml-2 size-4" />
      </Button>
    ),
  },
  {
    accessorKey: "saves",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Saves
        <ArrowUpDown className="ml-2 size-4" />
      </Button>
    ),
  },
  {
    accessorKey: "downloads",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Downloads
        <ArrowUpDown className="ml-2 size-4" />
      </Button>
    ),
  },
  {
    accessorKey: "purchases",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Purchases
        <ArrowUpDown className="ml-2 size-4" />
      </Button>
    ),
  },
];
