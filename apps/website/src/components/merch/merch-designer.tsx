/* eslint-disable one-var, sort-vars -- Preserve hook and derived-value dependency order. */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCreateMerchDesignMutation } from "@/lib/soundkit-api-hooks";
import type { MerchCatalogProduct } from "@/lib/soundkit-api-hooks";

export function MerchDesigner({
  products,
  variants,
  initialProductId,
  onCreated,
}: {
  initialProductId: string;
  onCreated: () => void;
  products: MerchCatalogProduct[];
  variants: {
    basePriceCents: number;
    catalogProductId: string;
    color: string | null;
    colorCode: string | null;
    id: string;
    image: string | null;
    inStock: boolean;
    name: string;
    size: string | null;
  }[];
}) {
  const { toast } = useToast(),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [selectedProductId, setSelectedProductId] = useState(initialProductId),
    [placement, setPlacement] = useState(
      String(
        products.find((p) => p.id === initialProductId)?.placements[0]
          ?.placement ?? "front"
      )
    ),
    [retailPrice, setRetailPrice] = useState(""),
    [designFileUrl, setDesignFileUrl] = useState(""),
    [projectId, setProjectId] = useState(""),
    [trackId, setTrackId] = useState(""),
    createDesign = useCreateMerchDesignMutation(),
    selectedProduct = products.find((p) => p.id === selectedProductId),
    selectedVariants = variants.filter(
      (v) => v.catalogProductId === selectedProductId
    ),
    baseCost = selectedVariants.some((v) => v.inStock)
      ? Math.min(
          ...selectedVariants
            .filter((v) => v.inStock)
            .map((v) => v.basePriceCents)
        )
      : 0,
    retailPriceCents = Math.round(Number(retailPrice) * 100) || 0,
    platformCut = Math.round(retailPriceCents * 0.12),
    artistPayout = retailPriceCents - platformCut - baseCost,
    placements = (selectedProduct?.placements ?? []).flatMap((p) =>
      typeof p.placement === "string" ? [p.placement] : []
    ),
    handleCreate = () => {
      if (
        !title.trim() ||
        !selectedProductId ||
        !designFileUrl.trim() ||
        retailPriceCents < (selectedProduct?.retailMinCents ?? 1200) ||
        retailPriceCents > (selectedProduct?.retailMaxCents ?? 0) ||
        !placements.includes(placement)
      ) {
        toast({
          description:
            "Fill in the title, pick a blank, and set a valid price.",
          title: "Missing details",
          variant: "destructive",
        });
        return;
      }

      createDesign.mutate(
        {
          designFileObjectKey: designFileUrl.trim(),
          placement,
          printfulCatalogProductId: selectedProductId,
          retailPriceCents,
          title: title.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(projectId.trim() ? { projectId: projectId.trim() } : {}),
          ...(trackId.trim() ? { trackId: trackId.trim() } : {}),
        },
        {
          onError: (error) => {
            toast({
              description:
                error instanceof Error ? error.message : "Failed to create.",
              title: "Creation failed",
              variant: "destructive",
            });
          },
          onSuccess: () => {
            toast({
              description: `"${title}" created — mockups are generating.`,
              title: "Design created",
            });
            setTitle("");
            setDescription("");
            setDesignFileUrl("");
            setRetailPrice("");
            onCreated();
          },
        }
      );
    };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-black uppercase tracking-tight">
          New apparel design
        </CardTitle>
        <CardDescription>
          Add your print-ready artwork and set your price. Mockups generate
          automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="merch-title">Title</Label>
            <Input
              id="merch-title"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 'Midnight Tour 2026 Tee'"
              value={title}
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="merch-description">Description (optional)</Label>
            <Textarea
              id="merch-description"
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="merch-blank">Blank (apparel product)</Label>
            <Select
              onValueChange={(id) => {
                setSelectedProductId(id);
                const first = products.find((p) => p.id === id)?.placements[0]
                  ?.placement;
                setPlacement(typeof first === "string" ? first : "");
              }}
              value={selectedProductId}
            >
              <SelectTrigger id="merch-blank">
                <SelectValue placeholder="Choose a blank…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="merch-placement">Placement</Label>
            <Select onValueChange={setPlacement} value={placement}>
              <SelectTrigger id="merch-placement">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(placements.length > 0 ? placements : ["front"]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="merch-file">Print file URL</Label>
            <Input
              id="merch-file"
              onChange={(e) => setDesignFileUrl(e.target.value)}
              placeholder="https://media.mysoundkit.com/merch/…"
              value={designFileUrl}
            />
            <p className="text-muted-foreground text-xs">
              Transparent PNG recommended, 300 DPI for best quality.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="merch-project">Project (optional)</Label>
              <Input
                id="merch-project"
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="Project ID"
                value={projectId}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="merch-track">Track (optional)</Label>
              <Input
                id="merch-track"
                onChange={(e) => setTrackId(e.target.value)}
                placeholder="Track ID"
                value={trackId}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="merch-price">
              Retail price (USD)
              {selectedProduct
                ? ` — $${(selectedProduct.retailMinCents / 100).toFixed(2)} to $${(selectedProduct.retailMaxCents / 100).toFixed(2)}`
                : ""}
            </Label>
            <Input
              id="merch-price"
              inputMode="decimal"
              onChange={(e) => setRetailPrice(e.target.value)}
              placeholder={
                selectedProduct
                  ? `${(selectedProduct.retailMinCents / 100).toFixed(2)}`
                  : "25.00"
              }
              type="number"
              value={retailPrice}
            />
          </div>
          {retailPriceCents > 0 && baseCost > 0 ? (
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-sm">
              <p className="font-semibold">Estimated payout</p>
              <p className="text-2xl font-black tabular-nums">
                ${(artistPayout / 100).toFixed(2)}
              </p>
              <p className="text-muted-foreground text-xs">
                ${((retailPriceCents - baseCost) / 100).toFixed(2)} after blank
                cost (${(baseCost / 100).toFixed(2)}) minus 12% platform fee ($
                {(platformCut / 100).toFixed(2)}). Shipping is pass-through.
                This estimate uses the lowest in-stock blank cost; costs vary by
                variant.
              </p>
            </div>
          ) : null}
          <Button
            className="w-full"
            disabled={createDesign.isPending}
            onClick={handleCreate}
          >
            {createDesign.isPending ? "Creating…" : "Create design"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
