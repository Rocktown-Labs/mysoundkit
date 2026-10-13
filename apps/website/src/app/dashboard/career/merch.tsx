import { createFileRoute } from "@tanstack/react-router";
import { Plus, Shirt, Trash2 } from "lucide-react";
import { useState } from "react";

import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateMerchDesignMutation,
  useDeleteMerchDesignMutation,
  useMerchCatalogQuery,
  useMerchDesignMockupsQuery,
  useMerchDesignsQuery,
  useUpdateMerchDesignMutation,
} from "@/lib/soundkit-api-hooks";
import type { MerchCatalogProduct, MerchDesign } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/career/merch")({
  component: MerchStudioPage,
});

function MerchStudioPage() {
  const [isCreating, setIsCreating] = useState(false),
    [selectedDesignId, setSelectedDesignId] = useState<string | null>(null),
    { data: catalogData } = useMerchCatalogQuery(),
    { data: designs = [], isLoading } = useMerchDesignsQuery();

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-black text-2xl uppercase tracking-tight">
            Merch Studio
          </h1>
          <p className="text-muted-foreground text-sm">
            Design apparel and accessories, preview photorealistic mockups,
            and publish them to your fans.
          </p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)} variant="outline">
          <Plus className="mr-2 size-4" />
          {isCreating ? "Close" : "New Design"}
        </Button>
      </section>

      {isCreating ? (
        <MerchDesigner
          products={catalogData?.products ?? []}
          variants={catalogData?.variants ?? []}
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="font-black text-lg uppercase tracking-tight">
          Your Designs ({designs.length})
        </h2>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading designs…</p>
        ) : designs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Shirt className="text-muted-foreground size-12" />
              <div>
                <p className="font-black uppercase tracking-tight">
                  No designs yet
                </p>
                <p className="text-muted-foreground text-sm">
                  Create your first merch design — upload artwork, pick a
                  blank, set your price, and Printful handles the rest.
                </p>
              </div>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="mr-2 size-4" />
                Create a design
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {designs.map((design) => (
              <DesignCard
                design={design}
                isSelected={selectedDesignId === design.id}
                key={design.id}
                onSelect={() =>
                  setSelectedDesignId(
                    selectedDesignId === design.id ? null : design.id
                  )
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MerchDesigner({
  products,
  variants,
}: {
  products: MerchCatalogProduct[];
  variants: Array<{
    basePriceCents: number;
    catalogProductId: string;
    color: string | null;
    colorCode: string | null;
    id: string;
    image: string | null;
    inStock: boolean;
    name: string;
    size: string | null;
  }>;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [placement, setPlacement] = useState("front");
  const [retailPrice, setRetailPrice] = useState("");
  const [designFileUrl, setDesignFileUrl] = useState("");
  const [projectId, setProjectId] = useState("");
  const [trackId, setTrackId] = useState("");

  const createDesign = useCreateMerchDesignMutation();
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const selectedVariants = variants.filter(
    (v) => v.catalogProductId === selectedProductId
  );
  const baseCost =
    selectedVariants.length > 0
      ? Math.min(...selectedVariants.map((v) => v.basePriceCents))
      : 0;
  const retailPriceCents = Math.round(Number(retailPrice) * 100) || 0;
  const platformCut = Math.round(retailPriceCents * 0.12);
  const artistPayout = retailPriceCents - platformCut - baseCost;
  const placements = (selectedProduct?.placements ?? [])
    .map((p) => p.placement as string)
    .filter(Boolean);

  const handleCreate = () => {
    if (
      !title.trim() ||
      !selectedProductId ||
      !designFileUrl.trim() ||
      retailPriceCents < (selectedProduct?.retailMinCents ?? 1200)
    ) {
      toast({
        description: "Fill in the title, pick a blank, and set a valid price.",
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
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-black uppercase tracking-tight">
          New merch design
        </CardTitle>
        <CardDescription>
          Upload artwork, pick a blank, set your price. Mockups generate
          automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="merch-title">Title</Label>
            <Input
              id="merch-title"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 'Midnight Tour 2026 Tee'"
              value={title}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="merch-blank">Blank (apparel product)</Label>
            <Select
              onValueChange={setSelectedProductId}
              value={selectedProductId}
            >
              <SelectTrigger id="merch-blank">
                <SelectValue placeholder="Choose a blank…" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="merch-placement">Placement</Label>
            <Select onValueChange={setPlacement} value={placement}>
              <SelectTrigger id="merch-placement">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(placements.length > 0 ? placements : ["front"]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor="merch-project">Project (optional)</Label>
              <Input
                id="merch-project"
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="Project ID"
                value={projectId}
              />
            </div>
            <div className="space-y-2">
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
        <div className="space-y-4">
          <div className="space-y-2">
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
              <p className="font-semibold">Your payout</p>
              <p className="text-2xl font-black tabular-nums">
                ${(artistPayout / 100).toFixed(2)}
              </p>
              <p className="text-muted-foreground text-xs">
                ${((retailPriceCents - baseCost) / 100).toFixed(2)} after
                blank cost (${(baseCost / 100).toFixed(2)}) minus 12% platform
                fee (${(platformCut / 100).toFixed(2)}). Shipping is
                pass-through — the fan pays it.
              </p>
            </div>
          ) : null}
          {selectedVariants.length > 0 ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">
                {selectedVariants.length} variants available for this blank.
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

function DesignCard({
  design,
  isSelected,
  onSelect,
}: {
  design: MerchDesign;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { toast } = useToast();
  const updateDesign = useUpdateMerchDesignMutation();
  const deleteDesign = useDeleteMerchDesignMutation();
  const { data: mockups = [] } = useMerchDesignMockupsQuery(
    isSelected ? design.id : null
  );
  const completedMockups = mockups.filter((m) => m.status === "completed");

  const statusColor =
    design.status === "published"
      ? "bg-emerald-600"
      : design.status === "ready"
        ? "bg-primary"
        : design.status === "archived"
          ? "bg-muted-foreground"
          : "bg-muted";

  return (
    <Card
      className={`cursor-pointer transition-all ${isSelected ? "ring-primary ring-2" : ""}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-sm font-semibold">
            {design.title}
          </CardTitle>
          <Badge className="shrink-0 text-[10px]" variant="outline">
            {design.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {completedMockups.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {completedMockups.slice(0, 3).map((m) => (
              <AppImage
                alt={`${design.title} mockup`}
                className="aspect-square rounded-md border border-border/40 object-cover"
                height={160}
                key={m.id}
                src={m.mockupUrl ?? ""}
                width={160}
              />
            ))}
          </div>
        ) : (
          <div className="bg-muted text-muted-foreground flex aspect-square items-center justify-center rounded-md text-xs">
            {design.mockupCount > 0
              ? `Generating ${design.mockupCount} mockups…`
              : "No mockups yet"}
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold tabular-nums">
            ${(design.retailPriceCents / 100).toFixed(2)}
          </span>
          <span className="text-muted-foreground text-xs">
            {design.readyMockupCount}/{design.mockupCount} ready
          </span>
        </div>
        <div className="flex gap-1">
          {design.status !== "published" ? (
            <Button
              className="h-8 flex-1 text-xs"
              disabled={
                design.readyMockupCount === 0 || updateDesign.isPending
              }
              onClick={() =>
                updateDesign.mutate(
                  { id: design.id, status: "published" },
                  {
                    onError: (error) =>
                      toast({
                        description:
                          error instanceof Error
                            ? error.message
                            : "Failed to publish.",
                        title: "Publish failed",
                        variant: "destructive",
                      }),
                    onSuccess: () =>
                      toast({
                        description: `"${design.title}" is live in your shop.`,
                        title: "Published",
                      }),
                  }
                )
              }
              size="sm"
            >
              Publish
            </Button>
          ) : (
            <Button
              className="h-8 flex-1 text-xs"
              onClick={() =>
                updateDesign.mutate({ id: design.id, status: "draft" })
              }
              size="sm"
              variant="outline"
            >
              Unpublish
            </Button>
          )}
          <Button
            aria-label={`Delete ${design.title}`}
            className="h-8"
            onClick={() =>
              deleteDesign.mutate(design.id, {
                onSuccess: () =>
                  toast({
                    description: `"${design.title}" archived.`,
                    title: "Deleted",
                  }),
              })
            }
            size="icon"
            variant="ghost"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
        {isSelected ? (
          <div className="space-y-2 border-border/30 border-t pt-3">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Mockup gallery
            </p>
            <div className="grid grid-cols-4 gap-1">
              {mockups.map((m) => (
                <div
                  className="relative aspect-square overflow-hidden rounded border border-border/40"
                  key={m.id}
                >
                  {m.mockupUrl ? (
                    <AppImage
                      alt="mockup"
                      className="size-full object-cover"
                      height={80}
                      src={m.mockupUrl}
                      width={80}
                    />
                  ) : (
                    <div className="bg-muted text-muted-foreground flex size-full items-center justify-center text-[9px]">
                      {m.status}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
