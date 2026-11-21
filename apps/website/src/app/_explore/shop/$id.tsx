import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Disc3,
  Download,
  Globe,
  Minus,
  Package,
  Plus,
  Printer,
  ShieldCheck,
  Shirt,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useCart } from "@/components/cart-provider";
import { PhysicalMediaVisual } from "@/components/shop/physical-media-visual";
import {
  PHYSICAL_FORMAT_LABELS,
  formatShopPrice,
  formatTechniqueLabel,
  getSizesForMerchColor,
  getUniqueMerchColors,
} from "@/components/shop/shop-model";
import {
  ShopMerchCard,
  ShopPhysicalReleaseCard,
} from "@/components/shop/shop-product-card";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  usePublicMerchDesignQuery,
  usePublicMerchQuery,
  usePublicPhysicalReleaseQuery,
  usePublicPhysicalReleasesQuery,
} from "@/lib/soundkit-api-hooks";
import type {
  PublicMerchDesign,
  PublicPhysicalRelease,
} from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

interface ShopDetailSearch {
  type?: "merch" | "release";
}

export const Route = createFileRoute("/_explore/shop/$id")({
  component: ShopDetailPage,
  validateSearch: (search: Record<string, unknown>): ShopDetailSearch => ({
    type:
      search.type === "merch" || search.type === "release"
        ? search.type
        : undefined,
  }),
});

function ShopDetailPage() {
  const { id } = Route.useParams(),
    { type } = Route.useSearch(),
    merchQuery = usePublicMerchDesignQuery(id, type !== "release"),
    releaseQuery = usePublicPhysicalReleaseQuery(id, type !== "merch"),
    relatedMerchQuery = usePublicMerchQuery({ limit: 8 }),
    relatedReleasesQuery = usePublicPhysicalReleasesQuery({ limit: 8 }),
    isLoading =
      (type === "merch" && merchQuery.isLoading) ||
      (type === "release" && releaseQuery.isLoading) ||
      (!type &&
        !merchQuery.data &&
        !releaseQuery.data &&
        (merchQuery.isLoading || releaseQuery.isLoading)),
    merch = type === "release" ? undefined : merchQuery.data,
    release = type === "merch" ? undefined : releaseQuery.data;

  if (isLoading) {
    return <ShopDetailSkeleton />;
  }

  if (merch) {
    const relatedMerch = (relatedMerchQuery.data ?? [])
      .filter((item) => item.id !== merch.id)
      .slice(0, 4);

    return <MerchDetailView merch={merch} relatedMerch={relatedMerch} />;
  }

  if (release) {
    const relatedReleases = (relatedReleasesQuery.data ?? [])
      .filter((item) => item.id !== release.id)
      .slice(0, 4);

    return (
      <PhysicalReleaseDetailView
        relatedReleases={relatedReleases}
        release={release}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <Package className="size-12 text-muted-foreground opacity-50" />
      <div className="flex flex-col gap-1">
        <h1 className="font-bold text-2xl">Product not found</h1>
        <p className="text-muted-foreground text-sm">
          This item may have been archived or is no longer available in the
          SoundKit Store.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/shop">
          <ArrowLeft data-icon="inline-start" />
          Back to Store
        </Link>
      </Button>
    </div>
  );
}

function MerchDetailView({
  merch,
  relatedMerch,
}: {
  merch: PublicMerchDesign;
  relatedMerch: PublicMerchDesign[];
}) {
  const { addItem } = useCart(),
    colors = getUniqueMerchColors(merch.variantDetails),
    [selectedColorCode, setSelectedColorCode] = useState<string | null>(
      colors[0]?.colorCode ?? null
    ),
    availableSizes = getSizesForMerchColor(
      merch.variantDetails,
      selectedColorCode
    ),
    [selectedVariantId, setSelectedVariantId] = useState<string | null>(
      availableSizes[0]?.id ?? null
    ),
    [quantity, setQuantity] = useState(1),
    [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const nextSizes = getSizesForMerchColor(
      merch.variantDetails,
      selectedColorCode
    );
    if (!nextSizes.some((v) => v.id === selectedVariantId)) {
      setSelectedVariantId(nextSizes[0]?.id ?? null);
    }
  }, [merch.variantDetails, selectedColorCode, selectedVariantId]);

  const selectedColor = colors.find((c) => c.colorCode === selectedColorCode),
    selectedVariant = availableSizes.find((v) => v.id === selectedVariantId),
    galleryUrls = [
      ...(selectedColor?.mockupUrl ? [selectedColor.mockupUrl] : []),
      ...(merch.mockups ?? [])
        .map((m) => m?.mockupUrl)
        .filter((url): url is string => Boolean(url)),
      ...(merch.previewMockupUrl ? [merch.previewMockupUrl] : []),
    ].filter((url, idx, arr) => Boolean(url) && arr.indexOf(url) === idx),
    primaryImage = galleryUrls[activeImageIndex] ?? galleryUrls[0] ?? null,
    handleAddToCart = async () => {
      if (!selectedVariant) {
        toast({
          description: "Select an available color and size first.",
          title: "Variant required",
          variant: "destructive",
        });
        return;
      }

      const variantLabel = [selectedVariant.color, selectedVariant.size]
        .filter(Boolean)
        .join(" / ");

      try {
        await addItem({
          artistName: merch.artistName,
          coverArtUrl: primaryImage,
          merchDesignId: merch.id,
          priceCents: merch.retailPriceCents,
          printfulVariantId: selectedVariant.id,
          productType: "physical_merch",
          purchaseMode: "physical_merch",
          quantity,
          title: variantLabel ? `${merch.title} (${variantLabel})` : merch.title,
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Please sign in or try again shortly.",
          title: "Could not add to cart",
          variant: "destructive",
        });
      }
    };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-5 pb-20 md:px-6 md:py-8 lg:px-8">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs"
      >
        <Link
          className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
          to="/shop"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>
        <span>/</span>
        <Link className="hover:text-foreground" to="/shop">
          Store
        </Link>
        {merch.category ? (
          <>
            <span>/</span>
            <span>{merch.category}</span>
          </>
        ) : null}
        <span>/</span>
        <span className="truncate text-foreground">{merch.title}</span>
      </nav>

      {/* Main 2-column Fourthwall-style layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Left: Photo Gallery */}
        <div className="flex flex-col gap-3 lg:col-span-7">
          {galleryUrls.length >= 2 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {galleryUrls.slice(0, 4).map((url, idx) => (
                <button
                  className={cn(
                    "relative aspect-[4/5] overflow-hidden rounded-xl border bg-muted transition-all",
                    idx === activeImageIndex
                      ? "border-primary/70 ring-1 ring-primary/30"
                      : "border-border/50"
                  )}
                  key={url}
                  onClick={() => setActiveImageIndex(idx)}
                  type="button"
                >
                  <AppImage
                    alt={`${merch.title} view ${idx + 1}`}
                    className="size-full object-cover"
                    height={750}
                    src={url}
                    width={600}
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-border/50 bg-muted">
              {primaryImage ? (
                <AppImage
                  alt={`${merch.title} preview`}
                  className="size-full object-cover"
                  height={900}
                  src={primaryImage}
                  width={720}
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Shirt className="size-12 opacity-40" />
                  <span className="text-sm">Preview generating…</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Sticky Buy Box */}
        <div className="flex flex-col gap-6 rounded-2xl border border-border/50 bg-card p-5 sm:p-6 lg:sticky lg:top-6 lg:col-span-5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {merch.artistUsername ? (
                <Link
                  className="font-medium text-muted-foreground text-xs hover:text-primary"
                  params={{ username: merch.artistUsername }}
                  to="/artist/$username"
                >
                  {merch.artistName ?? merch.artistUsername}
                </Link>
              ) : (
                <span className="font-medium text-muted-foreground text-xs">
                  {merch.artistName ?? merch.brand ?? "SoundKit Creator"}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                {merch.category ? (
                  <Badge variant="secondary">{merch.category}</Badge>
                ) : null}
                <Badge variant="outline">
                  {formatTechniqueLabel(merch.technique)}
                </Badge>
              </div>
            </div>

            <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
              {merch.title}
            </h1>
            {merch.catalogProductName ? (
              <p className="text-muted-foreground text-xs">
                {merch.brand ? `${merch.brand} · ` : ""}
                {merch.catalogProductName}
              </p>
            ) : null}
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-bold text-2xl text-primary tabular-nums">
              {formatShopPrice(merch.retailPriceCents)}
            </span>
            <span className="text-muted-foreground text-xs">USD</span>
          </div>

          <Separator />

          {/* Color Swatches */}
          {colors.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Color</span>
                <span className="font-medium text-foreground">
                  {selectedColor?.color ?? "Default"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => {
                  const isSelected = selectedColorCode === color.colorCode;
                  return (
                    <button
                      aria-label={color.color}
                      aria-pressed={isSelected}
                      className={cn(
                        "relative flex size-8 items-center justify-center rounded-full border-2 transition-transform active:scale-95",
                        isSelected
                          ? "border-primary ring-2 ring-primary/35 ring-offset-2 ring-offset-card"
                          : "border-border/70"
                      )}
                      key={color.colorCode}
                      onClick={() => {
                        setSelectedColorCode(color.colorCode);
                        setActiveImageIndex(0);
                      }}
                      style={{ backgroundColor: color.colorCode }}
                      title={color.color}
                      type="button"
                    >
                      {isSelected ? (
                        <Check className="size-3.5 text-white drop-shadow" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Size Selector */}
          {availableSizes.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              <span className="font-medium text-muted-foreground text-xs">
                Size
              </span>
              <div className="flex flex-wrap gap-2">
                {availableSizes.map((variant) => {
                  const isSelected = selectedVariantId === variant.id;
                  return (
                    <Button
                      className="min-w-12 transition-transform active:scale-95"
                      key={variant.id}
                      onClick={() => setSelectedVariantId(variant.id)}
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                    >
                      {variant.size ?? "One Size"}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Quantity + Add to Cart */}
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-border/60 bg-background">
              <Button
                aria-label="Decrease quantity"
                className="size-10 rounded-r-none"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                size="icon"
                variant="ghost"
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-10 text-center font-medium text-sm tabular-nums">
                {quantity}
              </span>
              <Button
                aria-label="Increase quantity"
                className="size-10 rounded-l-none"
                disabled={quantity >= 10}
                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                size="icon"
                variant="ghost"
              >
                <Plus className="size-4" />
              </Button>
            </div>

            <Button
              className="h-10 flex-1 transition-transform active:scale-[0.98]"
              disabled={!selectedVariant}
              onClick={() => void handleAddToCart()}
            >
              <ShoppingCart data-icon="inline-start" />
              Add to Cart · {formatShopPrice(merch.retailPriceCents * quantity)}
            </Button>
          </div>

          {merch.description ? (
            <>
              <Separator />
              <p className="whitespace-pre-line text-muted-foreground text-sm leading-relaxed">
                {merch.description}
              </p>
            </>
          ) : null}

          <Separator />

          {/* Fulfillment & Guarantees */}
          <ul className="flex flex-col gap-2.5 text-muted-foreground text-xs">
            <li className="flex items-center gap-2.5">
              <Printer className="size-4 shrink-0 text-primary" />
              <span>
                Printed on demand with verified{" "}
                {formatTechniqueLabel(merch.technique).toLowerCase()}{" "}
                fulfillment
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <Globe className="size-4 shrink-0 text-primary" />
              <span>Ships worldwide directly to your door</span>
            </li>
            <li className="flex items-center gap-2.5">
              <ShieldCheck className="size-4 shrink-0 text-primary" />
              <span>Directly supports the artist on SoundKit</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Related Merch */}
      {relatedMerch.length > 0 ? (
        <section className="flex flex-col gap-4 pt-4">
          <h2 className="font-semibold text-xl">You may also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {relatedMerch.map((item) => (
              <ShopMerchCard key={item.id} merch={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PhysicalReleaseDetailView({
  relatedReleases,
  release,
}: {
  relatedReleases: PublicPhysicalRelease[];
  release: PublicPhysicalRelease;
}) {
  const { addItem } = useCart(),
    navigate = useNavigate(),
    [quantity, setQuantity] = useState(1),
    formatLabel =
      PHYSICAL_FORMAT_LABELS[release.mediaFormat] ?? release.mediaFormat,
    handleAddToCart = async () => {
      await addItem({
        artistName: release.artistName,
        coverArtUrl: release.coverArtUrl,
        mediaFormat: release.mediaFormat,
        physicalReleaseId: release.id,
        priceCents: release.retailPriceCents,
        productType: "physical_merch",
        projectId: release.projectId ?? undefined,
        purchaseMode: "physical_merch",
        quantity,
        title: `${release.title} (${formatLabel})`,
        trackId: release.trackId ?? undefined,
      });
    };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-5 pb-20 md:px-6 md:py-8 lg:px-8">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs"
      >
        <Link
          className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
          to="/shop"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>
        <span>/</span>
        <Link className="hover:text-foreground" to="/shop">
          Store
        </Link>
        <span>/</span>
        <span>{formatLabel}</span>
        <span>/</span>
        <span className="truncate text-foreground">{release.title}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Left: Physical Media Showcase */}
        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-2xl border border-border/50">
            <PhysicalMediaVisual
              artworkUrl={release.coverArtUrl}
              format={release.mediaFormat}
              size="lg"
              title={release.title}
            />
          </div>
        </div>

        {/* Right: Sticky Buy Box */}
        <div className="flex flex-col gap-6 rounded-2xl border border-border/50 bg-card p-5 sm:p-6 lg:sticky lg:top-6 lg:col-span-5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {release.artistUsername ? (
                <Link
                  className="font-medium text-muted-foreground text-xs hover:text-primary"
                  params={{ username: release.artistUsername }}
                  to="/artist/$username"
                >
                  {release.artistName ?? release.artistUsername}
                </Link>
              ) : (
                <span className="font-medium text-muted-foreground text-xs">
                  {release.artistName ?? "SoundKit Artist"}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary">
                  <Disc3 className="size-3" data-icon="inline-start" />
                  {formatLabel}
                </Badge>
                {release.includesDigitalDownload ? (
                  <Badge variant="default">+ Digital Included</Badge>
                ) : null}
              </div>
            </div>

            <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
              {release.title}
            </h1>
            {release.genreName ? (
              <p className="text-muted-foreground text-xs">
                {release.genreName}
                {release.projectTitle ? ` · ${release.projectTitle}` : ""}
              </p>
            ) : null}
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-bold text-2xl text-primary tabular-nums">
              {formatShopPrice(release.retailPriceCents)}
            </span>
            <span className="text-muted-foreground text-xs">
              {release.currency}
            </span>
          </div>

          {/* Edition / Format Switcher */}
          {release.siblingFormats.length > 1 ? (
            <>
              <Separator />
              <div className="flex flex-col gap-2.5">
                <span className="font-medium text-muted-foreground text-xs">
                  Edition / Format
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {release.siblingFormats.map((option) => {
                    const isCurrent =
                      option.mediaFormat === release.mediaFormat &&
                      option.id === release.id;
                    return (
                      <button
                        className={cn(
                          "flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all active:scale-[0.98]",
                          isCurrent
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border/60 bg-background/60 text-muted-foreground hover:border-border hover:text-foreground"
                        )}
                        key={`${option.mediaFormat}-${option.id}`}
                        onClick={() => {
                          if (isCurrent) {
                            return;
                          }
                          if (option.mediaFormat === "digital") {
                            if (release.projectId) {
                              void navigate({
                                params: { id: release.projectId },
                                to: "/projects/$id",
                              });
                            } else if (release.trackId) {
                              void navigate({
                                params: { id: release.trackId },
                                to: "/tracks/$id",
                              });
                            }
                            return;
                          }
                          void navigate({
                            params: { id: option.id },
                            search: { type: "release" },
                            to: "/shop/$id",
                          });
                        }}
                        type="button"
                      >
                        <span className="font-medium text-xs">
                          {PHYSICAL_FORMAT_LABELS[option.mediaFormat]}
                        </span>
                        <span className="font-semibold text-primary text-xs tabular-nums">
                          {formatShopPrice(option.retailPriceCents)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}

          <Separator />

          {/* Quantity + Add to Cart */}
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-border/60 bg-background">
              <Button
                aria-label="Decrease quantity"
                className="size-10 rounded-r-none"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                size="icon"
                variant="ghost"
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-10 text-center font-medium text-sm tabular-nums">
                {quantity}
              </span>
              <Button
                aria-label="Increase quantity"
                className="size-10 rounded-l-none"
                disabled={quantity >= 10}
                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                size="icon"
                variant="ghost"
              >
                <Plus className="size-4" />
              </Button>
            </div>

            <Button
              className="h-10 flex-1 transition-transform active:scale-[0.98]"
              onClick={() => void handleAddToCart()}
            >
              <ShoppingCart data-icon="inline-start" />
              Add to Cart ·{" "}
              {formatShopPrice(release.retailPriceCents * quantity)}
            </Button>
          </div>

          {release.description ? (
            <>
              <Separator />
              <p className="whitespace-pre-line text-muted-foreground text-sm leading-relaxed">
                {release.description}
              </p>
            </>
          ) : null}

          <Separator />

          <ul className="flex flex-col gap-2.5 text-muted-foreground text-xs">
            <li className="flex items-center gap-2.5">
              <Package className="size-4 shrink-0 text-primary" />
              <span>Manufactured &amp; packaged on demand ({formatLabel})</span>
            </li>
            {release.includesDigitalDownload ? (
              <li className="flex items-center gap-2.5">
                <Download className="size-4 shrink-0 text-primary" />
                <span>
                  Includes instant digital download in your SoundKit library
                </span>
              </li>
            ) : null}
            <li className="flex items-center gap-2.5">
              <ShieldCheck className="size-4 shrink-0 text-primary" />
              <span>Ships with tracked physical delivery</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Related Physical Releases */}
      {relatedReleases.length > 0 ? (
        <section className="flex flex-col gap-4 pt-4">
          <h2 className="font-semibold text-xl">More physical editions</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {relatedReleases.map((item) => (
              <ShopPhysicalReleaseCard key={item.id} release={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ShopDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 md:px-6 lg:px-8">
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="grid grid-cols-2 gap-3 lg:col-span-7">
          <Skeleton className="aspect-[4/5] rounded-xl" />
          <Skeleton className="aspect-[4/5] rounded-xl" />
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-border/50 p-6 lg:col-span-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
