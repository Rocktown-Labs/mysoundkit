"use client";

import { ShoppingCart } from "lucide-react";
import { useState } from "react";

import { useCart } from "@/components/cart-provider";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export interface PublicMerchDesignCard {
  artistName: string | null;
  catalogProductId: string;
  description: string | null;
  id: string;
  previewMockupUrl: string | null;
  projectId: string | null;
  retailPriceCents: number;
  title: string;
  trackId: string | null;
  variantDetails: {
    color: string | null;
    colorCode: string | null;
    id: string;
    inStock: boolean;
    size: string | null;
  }[];
}

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`,
  uniqueColors = (variants: PublicMerchDesignCard["variantDetails"]) => [
    ...new Map(
      variants
        .filter((v) => v.color && v.colorCode)
        .map((v) => [v.colorCode ?? v.color ?? "", v])
    ).values(),
  ],
  sizesForColor = (
    variants: PublicMerchDesignCard["variantDetails"],
    colorCode: string | null
  ) =>
    variants.filter(
      (v) => v.inStock && (colorCode === null || v.colorCode === colorCode)
    );

export function MerchCard({ merch }: { merch: PublicMerchDesignCard }) {
  const { addItem } = useCart(),
   colors = uniqueColors(merch.variantDetails),
   [selectedColorCode, setSelectedColorCode] = useState<string | null>(
    colors[0]?.colorCode ?? null
  ),
   availableSizes = sizesForColor(merch.variantDetails, selectedColorCode),
   [selectedSize, setSelectedSize] = useState<string | null>(
    availableSizes[0]?.id ?? null
  ),

   selectedVariant = availableSizes.find((v) => v.id === selectedSize),
    handleAddToCart = () => {
      if (!selectedVariant) {
        toast({
          description: "This design has no available variants right now.",
          title: "Out of stock",
          variant: "destructive",
        });
        return;
      }

      addItem({
        artistName: merch.artistName,
        coverArtUrl: merch.previewMockupUrl,
        priceCents: merch.retailPriceCents,
        productType: "physical_merch",
        projectId: undefined,
        purchaseMode: "physical_merch",
        quantity: 1,
        title: merch.title,
      });

      toast({
        description: `"${merch.title}" added to your cart.`,
        title: "Added to Cart",
      });
    };

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-border/40 bg-card transition-all hover:border-border/60 hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-muted">
        {merch.previewMockupUrl ? (
          <AppImage
            alt={`${merch.title} preview`}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            height={480}
            src={merch.previewMockupUrl}
            width={480}
          />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center text-sm">
            Preview generating…
          </div>
        )}
        <Badge className="absolute top-2 left-2 bg-background/80 text-primary backdrop-blur-sm">
          {formatPrice(merch.retailPriceCents)}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-sm">{merch.title}</p>
          {merch.artistName ? (
            <p className="text-muted-foreground truncate text-xs">
              by {merch.artistName}
            </p>
          ) : null}
        </div>

        {colors.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {colors.slice(0, 5).map((color) => (
              <button
                aria-label={color.color ?? "Color"}
                className={`size-5 rounded-full border-2 transition-all ${
                  selectedColorCode === color.colorCode
                    ? "border-primary scale-110"
                    : "border-border/50"
                }`}
                key={color.colorCode ?? color.color}
                onClick={() => {
                  setSelectedColorCode(color.colorCode);
                  const newSizes = sizesForColor(
                    merch.variantDetails,
                    color.colorCode
                  );
                  setSelectedSize(newSizes[0]?.id ?? null);
                }}
                style={{
                  backgroundColor: color.colorCode ?? "#ccc",
                }}
                type="button"
              />
            ))}
          </div>
        ) : null}

        {availableSizes.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {availableSizes.slice(0, 6).map((variant) => (
              <button
                className={`rounded-md border px-2 py-1 text-xs font-medium transition-all ${
                  selectedSize === variant.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 text-muted-foreground hover:border-border"
                }`}
                key={variant.id}
                onClick={() => setSelectedSize(variant.id)}
                type="button"
              >
                {variant.size ?? "One Size"}
              </button>
            ))}
          </div>
        ) : null}

        <Button
          className="mt-auto w-full"
          disabled={!selectedVariant}
          onClick={handleAddToCart}
          size="sm"
        >
          <ShoppingCart className="mr-2 size-4" />
          Add to Cart
        </Button>
      </div>
    </div>
  );
}
