/* eslint-disable react-perf/jsx-no-new-function-as-prop */
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Play, Download } from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
import { Button } from "@/components/ui/button";

export interface PurchasedTrack {
  id: string;
  title: string;
  artist: string;
  artistSlug: string;
  cover: string;
  duration?: string | null;
  licenseName?: string | null;
  priceCents?: number;
  priceLabel: string;
  productId?: string;
  productType?: "track" | "project";
  purchaseMode?: "digital_download" | "license";
  purchasedAt: string;
  downloadUrl?: string | null;
  regionSlug?: string | null;
  slug?: string | null;
}

export const columns: ColumnDef<PurchasedTrack>[] = [
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
        <button
          type="button"
          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        >
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
    cell: ({ row }) => {
      const productId = row.original.productId ?? row.original.id;

      if (row.original.productType === "project") {
        return (
          <Link
            to="/projects/$id"
            params={{ id: productId }}
            className="font-medium hover:text-primary"
          >
            {row.getValue("title")}
          </Link>
        );
      }

      return (
        <Link
          params={
            row.original.regionSlug && row.original.slug
              ? {
                  regionSlug: row.original.regionSlug,
                  slug: row.original.slug,
                }
              : { id: productId }
          }
          to={
            row.original.regionSlug && row.original.slug
              ? "/tracks/$regionSlug/$slug"
              : "/tracks/$id"
          }
          className="font-medium hover:text-primary"
        >
          {row.getValue("title")}
        </Link>
      );
    },
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
    accessorKey: "priceLabel",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Price
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "duration",
    header: "Duration",
  },
  {
    accessorKey: "purchaseMode",
    cell: ({ row }) =>
      row.original.purchaseMode === "license"
        ? (row.original.licenseName ?? "License")
        : "Digital Download",
    header: "Type",
  },
  {
    accessorKey: "purchasedAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Purchase Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    cell: () => (
      <Button size="sm" variant="outline">
        <Download className="mr-2 h-4 w-4" />
        Download
      </Button>
    ),
    id: "actions",
  },
];
