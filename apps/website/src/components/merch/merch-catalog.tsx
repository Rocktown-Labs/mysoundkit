/* eslint-disable one-var, sort-vars -- Keep derived values beside the hooks they depend on. */
import { ArrowRight, ArrowLeft, Search, Package, Check } from "lucide-react";
import { useState } from "react";

import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  MerchCatalogProduct,
  MerchCatalogVariant,
} from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

import { merchCategory as categoryOf } from "./merch-catalog-model";

const categories = [
  "All products",
  "Apparel",
  "Accessories",
  "Home & living",
] as const;
type Category = (typeof categories)[number];
export function merchPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

export function MerchCatalog({
  products,
  variants,
  onDesign,
  onBack,
}: {
  products: MerchCatalogProduct[];
  variants: MerchCatalogVariant[];
  onDesign: (id: string) => void;
  onBack: () => void;
}) {
  const [category, setCategory] = useState<Category>("All products"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<MerchCatalogProduct | null>(null),
    enabled = products.filter((product) => !product.isDiscontinued),
    filtered = enabled.filter(
      (product) =>
        (category === "All products" || categoryOf(product) === category) &&
        `${product.name} ${product.brand ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
    );
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <nav aria-label="Product categories" className="flex flex-wrap gap-2">
          {categories.map((item) => (
            <Button
              key={item}
              onClick={() => setCategory(item)}
              aria-pressed={category === item}
              variant={category === item ? "secondary" : "ghost"}
            >
              {item}
            </Button>
          ))}
        </nav>
        <div className="relative w-full sm:w-64">
          <Search
            className="absolute left-3 top-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Search catalog"
            className="pl-9"
            placeholder="Search products"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      <section className="grid gap-6 border-b pb-8 md:grid-cols-[1fr_auto] md:items-end">
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Made for your next release
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Your sound. Your signature.
          </h2>
          <p className="text-muted-foreground">
            Find your canvas. Explore apparel, accessories, and everyday
            essentials to make your own. Printed on demand, shipped to your
            fans.
          </p>
        </div>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="mr-2 size-4" />
          Your products
        </Button>
      </section>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xl font-semibold">{category}</h3>
        <span className="text-sm text-muted-foreground">
          {filtered.length} products
        </span>
      </div>
      {filtered.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => {
            const available = variants.filter(
                (variant) =>
                  variant.catalogProductId === product.id && variant.inStock
              ),
              colors = [
                ...new Set(
                  available.map((variant) => variant.color).filter(Boolean)
                ),
              ];
            return (
              <button
                type="button"
                key={product.id}
                className="group flex min-w-0 flex-col gap-3 rounded-sm text-left outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => setSelected(product)}
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
                  <AppImage
                    alt={product.name}
                    src={product.image}
                    width={480}
                    height={640}
                    className="size-full object-contain transition-transform duration-200 motion-safe:group-hover:scale-[1.025]"
                  />
                  <span className="absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full bg-background text-foreground shadow-sm">
                    <ArrowRight className="size-4" />
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {product.brand ?? categoryOf(product)}
                  </span>
                  <span className="font-medium leading-snug">
                    {product.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Retail {merchPrice(product.retailMinCents)}–
                    {merchPrice(product.retailMaxCents)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {colors.length ? `${colors.length} colors · ` : ""}
                    {available.length
                      ? "No minimum order"
                      : "Currently unavailable"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-16 text-center">
          <Package className="size-8 text-muted-foreground" />
          <h3 className="font-medium">No products found</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            {enabled.length
              ? "Try another search or category."
              : "The merch catalog is being prepared. Check back soon for available products."}
          </p>
          {search && (
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setCategory("All products");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
          {selected && (
            <CatalogDetails
              key={selected.id}
              product={selected}
              variants={variants.filter(
                (variant) => variant.catalogProductId === selected.id
              )}
              onDesign={() => {
                onDesign(selected.id);
                setSelected(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CatalogDetails({
  product,
  variants,
  onDesign,
}: {
  product: MerchCatalogProduct;
  variants: MerchCatalogVariant[];
  onDesign: () => void;
}) {
  const available = variants.filter((variant) => variant.inStock),
    [selectedVariant, setSelectedVariant] = useState(available[0]),
    colors = [
      ...new Map(
        available.map((variant) => [variant.color ?? "Default", variant])
      ).values(),
    ],
    sizes = [
      ...new Set(available.map((variant) => variant.size).filter(Boolean)),
    ],
    placements = product.placements.flatMap((item) =>
      typeof item.placement === "string"
        ? [item.placement.replaceAll("_", " ")]
        : []
    );
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="aspect-[3/4] overflow-hidden bg-muted">
        <AppImage
          alt={product.name}
          src={selectedVariant?.image ?? product.image}
          width={600}
          height={800}
          className="size-full object-contain"
        />
      </div>
      <div className="flex flex-col gap-5 py-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{product.brand}</p>
          <DialogTitle className="text-2xl leading-tight">
            {product.name}
          </DialogTitle>
          <DialogDescription>
            Made to order. Choose a blank and add your artwork.
          </DialogDescription>
        </div>
        {colors.length > 0 && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm">
              Color: {selectedVariant?.color ?? "Default"}
            </legend>
            <div className="flex flex-wrap gap-2">
              {colors.map((variant) => (
                <Button
                  key={variant.id}
                  variant={
                    selectedVariant?.color === variant.color
                      ? "secondary"
                      : "outline"
                  }
                  size="sm"
                  aria-pressed={selectedVariant?.color === variant.color}
                  onClick={() => setSelectedVariant(variant)}
                  className={cn(
                    "gap-2",
                    selectedVariant?.color === variant.color &&
                      "ring-1 ring-primary"
                  )}
                >
                  <span
                    className="size-3 rounded-full border"
                    style={{
                      backgroundColor:
                        variant.colorCode &&
                        /^#?[\da-f]{6}$/iu.test(variant.colorCode)
                          ? `#${variant.colorCode.replace("#", "")}`
                          : undefined,
                    }}
                  />
                  {variant.color ?? "Default"}
                </Button>
              ))}
            </div>
          </fieldset>
        )}
        {sizes.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Available sizes across colors
            </p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((size) => (
                <Badge key={size} variant="outline">
                  {size}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {placements.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Print placements</p>
            <p className="text-sm capitalize">{placements.join(" · ")}</p>
          </div>
        )}
        <div className="mt-auto flex flex-col gap-3 border-t pt-5">
          <p className="text-xl font-semibold">
            Retail {merchPrice(product.retailMinCents)}–
            {merchPrice(product.retailMaxCents)}
          </p>
          {available.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Base cost from{" "}
              {merchPrice(
                Math.min(...available.map((variant) => variant.basePriceCents))
              )}
              . Set your selling price in the next step.
            </p>
          )}
          <p className="flex items-center gap-2 text-sm">
            <Check className="size-4 text-primary" />
            No minimum orders
          </p>
          <Button
            disabled={!available.length || !placements.length}
            onClick={onDesign}
          >
            Continue with this product
            <ArrowRight className="ml-2 size-4" />
          </Button>
          {!available.length && (
            <p className="text-sm text-muted-foreground">
              This product is currently out of stock.
            </p>
          )}
          {!placements.length && (
            <p className="text-sm text-muted-foreground">
              Print placements are not available yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
