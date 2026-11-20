/* eslint-disable one-var, sort-vars, complexity -- Keep query state and derived display values together. */
import { Link } from "@tanstack/react-router";
import { Check, ExternalLink, Pencil, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useMerchDesignMockupsQuery,
  useRetryMerchMockupsMutation,
  useUpdateMerchDesignMutation,
} from "@/lib/soundkit-api-hooks";
import type {
  MerchCatalogProduct,
  MerchCatalogVariant,
  MerchDesign,
} from "@/lib/soundkit-api-hooks";

import { merchPrice } from "./merch-catalog";

export function MerchProductReview({
  design,
  product,
  variants,
  onDone,
  onEdit,
  onDirtyChange,
}: {
  design: MerchDesign;
  product?: MerchCatalogProduct;
  variants: MerchCatalogVariant[];
  onDone: () => void;
  onEdit?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [current, setCurrent] = useState(design);
  const [title, setTitle] = useState(design.title);
  const [description, setDescription] = useState(design.description ?? "");
  const [price, setPrice] = useState(String(design.retailPriceCents / 100));
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const mockups = useMerchDesignMockupsQuery(current.id);
  const retry = useRetryMerchMockupsMutation();
  const update = useUpdateMerchDesignMutation();
  const images =
    mockups.data?.filter(
      (mockup) => mockup.status === "completed" && mockup.mockupUrl
    ) ?? [];
  const ids = current.editorConfig?.variantIds;
  const ready = ids
    ? ids.every((id) => images.some((mockup) => mockup.catalogVariantId === id))
    : images.length > 0;
  const total = ids?.length ?? mockups.data?.length ?? 0;
  const failed =
    mockups.data?.filter((mockup) => mockup.status === "failed") ?? [];
  const selected = variants.filter(
    (variant) => !ids || ids.includes(variant.id)
  );
  const cents = Math.round(Number(price) * 100);
  const costs = selected.map((variant) => variant.basePriceCents);
  const fee = Math.round((cents * current.platformFeeBps) / 10_000);
  const low = costs.length ? cents - fee - Math.max(...costs) : null;
  const high = costs.length ? cents - fee - Math.min(...costs) : null;
  useEffect(() => {
    onDirtyChange?.(
      title !== current.title ||
        description !== (current.description ?? "") ||
        cents !== current.retailPriceCents
    );
  }, [title, description, cents, current, onDirtyChange]);
  const saveDetails = async (publish: boolean) => {
    if (
      !title.trim() ||
      !Number.isFinite(cents) ||
      (product &&
        (cents < product.retailMinCents || cents > product.retailMaxCents))
    ) {
      setError("Add a product name and a price within this product's range.");
      return;
    }
    setError("");
    try {
      await update.mutateAsync({
        description,
        id: current.id,
        retailPriceCents: cents,
        title: title.trim(),
        ...(publish ? { status: "published" as const } : {}),
      });
      setCurrent({
        ...current,
        description,
        retailPriceCents: cents,
        title: title.trim(),
        ...(publish
          ? { publishedAt: new Date().toISOString(), status: "published" }
          : {}),
      });
      if (!publish) {
        onDone();
      }
    } catch (error_) {
      setError(
        error_ instanceof Error
          ? error_.message
          : "Product update failed. Try again."
      );
    }
  };
  return (
    <div className="grid gap-7 lg:grid-cols-2">
      <section
        aria-label="Generated product mockups"
        className="flex min-w-0 flex-col gap-4"
      >
        <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-lg bg-muted/30">
          {images.length ? (
            <AppImage
              src={selectedImage ?? images[0]?.mockupUrl}
              alt={`${current.title} generated mockup`}
              width={600}
              height={700}
              className="max-h-[60dvh] w-full object-contain"
            />
          ) : (
            <div className="flex max-w-sm flex-col items-center gap-3 p-8 text-center">
              <RefreshCw className="size-8 text-muted-foreground" />
              <p className="font-medium">
                {failed.length
                  ? "Mockups need attention"
                  : "Your mockups are being prepared"}
              </p>
              <p className="text-sm text-muted-foreground">
                {failed.length
                  ? "Review the error below, then retry generation."
                  : "Your draft is saved. You can return to your products while each selected variant is rendered."}
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {images.map((mockup) => (
            <button
              type="button"
              className="shrink-0 rounded-md border p-1 focus-visible:outline-2 focus-visible:outline-ring"
              key={mockup.id}
              aria-label={`View mockup for ${variants.find((variant) => variant.id === mockup.catalogVariantId)?.name ?? mockup.catalogVariantId}`}
              onClick={() => setSelectedImage(mockup.mockupUrl)}
            >
              <AppImage
                src={mockup.mockupUrl}
                alt=""
                width={72}
                height={90}
                className="h-24 w-20 object-contain"
              />
            </button>
          ))}
        </div>
        <output className="text-sm text-muted-foreground">
          {images.length} of {total} mockups ready
        </output>
        {mockups.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              Mockups couldn’t load.{" "}
              <Button
                variant="link"
                onClick={() => {
                  void mockups.refetch();
                }}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {failed.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              {failed[0]?.error ?? "Mockup generation failed."}
            </AlertDescription>
          </Alert>
        )}
        {current.status !== "published" &&
          (failed.length > 0 ||
            (!mockups.isPending && !mockups.data?.length)) && (
            <Button
              variant="outline"
              disabled={retry.isPending}
              onClick={() =>
                retry.mutate(current.id, {
                  onError: (cause) =>
                    setError(
                      cause instanceof Error ? cause.message : "Retry failed."
                    ),
                })
              }
            >
              <RefreshCw />
              {retry.isPending ? "Queueing…" : "Retry mockups"}
            </Button>
          )}
      </section>
      <section className="flex flex-col gap-5" aria-label="Product details">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-2xl font-semibold">Product details</h3>
          <Badge
            variant={current.status === "published" ? "default" : "outline"}
          >
            {
              {
                archived: "Archived",
                draft: "Private draft",
                published: "Published",
                ready: "Private draft",
              }[current.status]
            }
          </Badge>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="merch-review-name">Product name</Label>
          <Input
            id="merch-review-name"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="merch-review-description">Description</Label>
          <Textarea
            id="merch-review-description"
            value={description}
            maxLength={2000}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="merch-review-price">Selling price (USD)</Label>
            <Input
              id="merch-review-price"
              type="number"
              min={product ? product.retailMinCents / 100 : 12}
              max={product ? product.retailMaxCents / 100 : undefined}
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </div>
          {low !== null && high !== null && (
            <div className="flex flex-col gap-1 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                Estimated proceeds per item
              </p>
              <p className="font-semibold">
                {merchPrice(low)}
                {high === low ? "" : `–${merchPrice(high)}`}
              </p>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Estimates subtract cached blank costs and the{" "}
          {current.platformFeeBps / 100}% platform fee. Final provider costs may
          vary. Shipping and taxes are calculated at checkout.
        </p>
        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="text-sm">Printed on demand. No minimum orders.</p>
          <p className="text-sm text-muted-foreground">
            {total} selected variants · {current.placement.replaceAll("_", " ")}{" "}
            · {current.technique.toUpperCase()}
          </p>
          {onEdit && !current.publishedAt && (
            <Button
              variant="outline"
              disabled={update.isPending}
              onClick={onEdit}
            >
              <Pencil />
              Edit artwork
            </Button>
          )}
        </div>
        {current.status === "published" ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 font-medium">
              <Check />
              Your product is live
            </p>
            <Button asChild>
              <Link to="/shop">
                View shop
                <ExternalLink />
              </Link>
            </Button>
            <Button variant="outline" onClick={onDone}>
              Back to your products
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {ready
                ? "Mockups are ready. Printful will verify the print file before this product goes live."
                : "Publishing unlocks when every selected variant has a completed mockup."}
            </p>
            <Button
              disabled={
                current.status === "archived" ||
                !ready ||
                update.isPending ||
                mockups.isError
              }
              onClick={() => {
                void saveDetails(true);
              }}
            >
              {update.isPending ? "Saving…" : "Publish product"}
            </Button>
            <Button
              variant="outline"
              disabled={update.isPending}
              onClick={() => {
                void saveDetails(false);
              }}
            >
              Save as draft
            </Button>
            <Button variant="ghost" onClick={onDone}>
              Back to your products
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
