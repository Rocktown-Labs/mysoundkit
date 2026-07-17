import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBag, ArrowLeft } from "lucide-react";

import { LibraryEmptyState } from "@/components/explore/library-empty-state";
import { Button } from "@/components/ui/button";
import { useLibraryPurchasesQuery } from "@/lib/soundkit-api-hooks";

import { columns } from "./-columns";
import { DataTable } from "./-data-table";

export const Route = createFileRoute("/_explore/library/purchased/")({
  component: PurchasedPage,
});

function PurchasedPage() {
  const { data = [], isLoading } = useLibraryPurchasesQuery();

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

      {isLoading || data.length > 0 ? (
        <DataTable columns={columns} data={data} />
      ) : (
        <LibraryEmptyState
          actionHref="/shop"
          actionLabel="Browse Shop"
          description="Music you purchase will appear here. Start with featured tracks or browse by genre."
          icon={ShoppingBag}
          secondaryHref="/tracks"
          secondaryLabel="Explore Songs"
          title="No purchases yet"
        />
      )}
    </div>
  );
}
