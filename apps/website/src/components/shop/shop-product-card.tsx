import { Link } from "@tanstack/react-router";
import { Disc3, Shirt } from "lucide-react";
import { useState } from "react";

import { PhysicalMediaVisual } from "@/components/shop/physical-media-visual";
import {
  PHYSICAL_FORMAT_LABELS,
  formatShopPrice,
  formatTechniqueLabel,
  getUniqueMerchColors,
} from "@/components/shop/shop-model";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import type {
  PublicMerchDesign,
  PublicPhysicalRelease,
} from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

export function ShopMerchCard({
  className,
  merch,
}: {
  className?: string;
  merch: PublicMerchDesign;
}) {
  const colors = getUniqueMerchColors(merch.variantDetails),
    [activeColorCode, setActiveColorCode] = useState<string | null>(
      colors[0]?.colorCode ?? null
    ),
    activeColor = colors.find((c) => c.colorCode === activeColorCode),
    activeImageUrl = activeColor?.mockupUrl ?? merch.previewMockupUrl,
    visibleColors = colors.slice(0, 6),
    extraColorCount = Math.max(0, colors.length - visibleColors.length);

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card transition-transform duration-150 active:scale-[0.99]",
        className
      )}
    >
      <Link
        className="relative block aspect-[4/5] w-full overflow-hidden bg-muted"
        params={{ id: merch.id }}
        search={{ type: "merch" }}
        to="/shop/$id"
      >
        {activeImageUrl ? (
          <AppImage
            alt={`${merch.title} preview`}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            height={600}
            src={activeImageUrl}
            width={480}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Shirt className="size-9 opacity-45" />
            <span className="text-xs">Preview generating…</span>
          </div>
        )}

        <div className="pointer-events-none absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          {merch.category ? (
            <Badge
              className="bg-background/85 text-foreground backdrop-blur-sm"
              variant="secondary"
            >
              {merch.category}
            </Badge>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <Link
          className="flex flex-col gap-0.5"
          params={{ id: merch.id }}
          search={{ type: "merch" }}
          to="/shop/$id"
        >
          <p className="truncate text-muted-foreground text-xs">
            {merch.artistName ?? merch.brand ?? "SoundKit Creator"}
          </p>
          <h3 className="line-clamp-2 font-semibold text-foreground text-sm leading-snug">
            {merch.title}
          </h3>
        </Link>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className="text-[10px]" variant="outline">
            {formatTechniqueLabel(merch.technique)}
          </Badge>
          <span className="text-muted-foreground text-xs">
            From{" "}
            <strong className="font-semibold text-primary">
              {formatShopPrice(merch.retailPriceCents)}
            </strong>
          </span>
        </div>

        {visibleColors.length > 0 ? (
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
            {visibleColors.map((color) => {
              const isSelected = activeColorCode === color.colorCode;
              return (
                <button
                  aria-label={`Preview ${color.color}`}
                  aria-pressed={isSelected}
                  className={cn(
                    "size-4 rounded-full border transition-transform active:scale-95",
                    isSelected
                      ? "border-primary ring-2 ring-primary/40 ring-offset-1 ring-offset-card"
                      : "border-border/70"
                  )}
                  key={color.colorCode}
                  onClick={() => setActiveColorCode(color.colorCode)}
                  style={{ backgroundColor: color.colorCode }}
                  title={color.color}
                  type="button"
                />
              );
            })}
            {extraColorCount > 0 ? (
              <span className="text-muted-foreground text-[11px] font-medium">
                +{extraColorCount}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function ShopPhysicalReleaseCard({
  className,
  release,
}: {
  className?: string;
  release: PublicPhysicalRelease;
}) {
  const formatLabel = PHYSICAL_FORMAT_LABELS[release.mediaFormat];

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card transition-transform duration-150 active:scale-[0.99]",
        className
      )}
    >
      <Link
        className="relative block w-full overflow-hidden"
        params={{ id: release.id }}
        search={{ type: "release" }}
        to="/shop/$id"
      >
        <PhysicalMediaVisual
          artworkUrl={release.coverArtUrl}
          className="aspect-[4/5]"
          format={release.mediaFormat}
          size="md"
          title={release.title}
        />

        <div className="pointer-events-none absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          <Badge
            className="bg-background/85 text-foreground backdrop-blur-sm"
            variant="secondary"
          >
            <Disc3 className="size-3" data-icon="inline-start" />
            {formatLabel}
          </Badge>
          {release.includesDigitalDownload ? (
            <Badge
              className="bg-primary/90 text-primary-foreground"
              variant="default"
            >
              + Digital
            </Badge>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <Link
          className="flex flex-col gap-0.5"
          params={{ id: release.id }}
          search={{ type: "release" }}
          to="/shop/$id"
        >
          <p className="truncate text-muted-foreground text-xs">
            {release.artistName ?? "SoundKit Artist"}
          </p>
          <h3 className="line-clamp-2 font-semibold text-foreground text-sm leading-snug">
            {release.title}
          </h3>
        </Link>

        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="font-semibold text-primary text-sm">
            {formatShopPrice(release.retailPriceCents)}
          </span>
          {release.siblingFormats.length > 1 ? (
            <span className="text-muted-foreground text-[11px]">
              {release.siblingFormats.length} formats
            </span>
          ) : (
            <span className="text-muted-foreground text-[11px]">
              {formatLabel}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
