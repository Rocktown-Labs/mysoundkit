/* eslint-disable no-use-before-define */
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBag, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { API_V1_URL } from "@/lib/api";

import { columns } from "./-columns";
import type { PurchasedTrack } from "./-columns";
import { DataTable } from "./-data-table";

const purchasedTracks: PurchasedTrack[] = [
  {
    artist: "Luna Eclipse",
    artistSlug: "luna-eclipse",
    cover: "/placeholder.svg?height=80&width=80",
    downloadUrl: "/downloads/midnight-vibes.mp3",
    duration: "3:45",
    id: "1",
    priceCents: 299,
    priceLabel: "$2.99",
    productType: "track",
    purchaseMode: "digital_download",
    purchasedAt: "Jan 15, 2025",
    title: "Midnight Vibes",
  },
  {
    artist: "Neon Pulse",
    artistSlug: "neon-pulse",
    cover: "/placeholder.svg?height=80&width=80",
    downloadUrl: "/downloads/electric-dreams.mp3",
    duration: "4:20",
    id: "2",
    priceCents: 299,
    priceLabel: "$2.99",
    productType: "track",
    purchaseMode: "digital_download",
    purchasedAt: "Jan 10, 2025",
    title: "Electric Dreams",
  },
  {
    artist: "Street Poet",
    artistSlug: "street-poet",
    cover: "/placeholder.svg?height=80&width=80",
    downloadUrl: "/downloads/street-poetry.mp3",
    duration: "3:15",
    id: "3",
    priceCents: 199,
    priceLabel: "$1.99",
    productType: "track",
    purchaseMode: "digital_download",
    purchasedAt: "Jan 5, 2025",
    title: "Street Poetry",
  },
  {
    artist: "Voltage Dreams",
    artistSlug: "voltage-dreams",
    cover: "/placeholder.svg?height=80&width=80",
    downloadUrl: "/downloads/voltage.mp3",
    duration: "3:58",
    id: "4",
    priceCents: 249,
    priceLabel: "$2.49",
    productType: "track",
    purchaseMode: "digital_download",
    purchasedAt: "Dec 28, 2024",
    title: "Voltage",
  },
];

export const Route = createFileRoute("/_explore/library/purchased/")({
  component: PurchasedPage,
});

const fetchPurchasedItems = async () => {
  const response = await fetch(`${API_V1_URL}/library/purchases`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Purchases request failed with ${response.status}`);
  }

  return (await response.json()) as PurchasedTrack[];
};

function PurchasedPage() {
  const { data } = useQuery({
    queryFn: fetchPurchasedItems,
    queryKey: ["library-purchases"],
    retry: false,
  });
  const rows = data ?? purchasedTracks;

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <Link to="/library" className="md:hidden">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2">
          <ArrowLeft className="mr-2 size-4" />
          Back to My SoundKit
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 flex items-center gap-3">
          <ShoppingBag className="size-8 text-primary" />
          Purchased Tracks
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Your digital music collection
        </p>
      </div>

      <DataTable columns={columns} data={rows} />
    </div>
  );
}
