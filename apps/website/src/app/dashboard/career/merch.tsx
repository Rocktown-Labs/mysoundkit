import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Disc3,
  Plus,
  Shirt,
  Trash2,
  TrendingUp,
} from "lucide-react";
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
  usePhysicalReleasesQuery,
  useUpdateMerchDesignMutation,
} from "@/lib/soundkit-api-hooks";
import type {
  MerchCatalogProduct,
  MerchDesign,
  PhysicalReleaseCard,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/career/merch")({
  component: MerchStudioPage,
});

const MEDIA_FORMAT_LABELS: Record<PhysicalReleaseCard["mediaFormat"], string> =
    {
      cd: "Audio CD",
      dvd: "Video DVD",
      vinyl_12: '12" Vinyl',
      vinyl_7: '7" Vinyl',
    },
  formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function MerchStudioPage() {
  const [isCreatingApparel, setIsCreatingApparel] = useState(false),
    [selectedDesignId, setSelectedDesignId] = useState<string | null>(null),
    { data: catalogData } = useMerchCatalogQuery(),
    { data: designs = [], isLoading: designsLoading } = useMerchDesignsQuery(),
    { data: physicalReleases = [] } = usePhysicalReleasesQuery();

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-black text-2xl uppercase tracking-tight">
            Merch Studio
          </h1>
          <p className="text-muted-foreground text-sm">
            Create and manage everything your fans can buy — physical media,
            apparel, and accessories, all in one place.
          </p>
        </div>
      </section>

      {/* Physical Media (Kunaki) — horizontal scroll */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-black text-lg uppercase tracking-tight">
              Physical Media
            </h2>
            <Badge className="text-[10px]" variant="outline">
              {physicalReleases.length}
            </Badge>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/projects">
              Create from a project
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
        {physicalReleases.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
              <Disc3 className="size-8" />
              <div>
                <p className="text-sm font-semibold">No physical media yet</p>
                <p className="text-xs">
                  CDs, vinyl, and DVDs are created from your project's monetize
                  settings. Open a project and enable physical editions.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="scrollbar-thin overflow-x-auto pb-2">
            <div className="flex gap-3">
              {physicalReleases.map((release) => (
                <div
                  className="w-44 shrink-0 overflow-hidden rounded-lg border border-border/40"
                  key={release.id}
                >
                  <div className="bg-muted/40 flex h-28 items-center justify-center">
                    <Disc3 className="text-muted-foreground/40 size-10" />
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="truncate text-sm font-semibold">
                      {release.title}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {MEDIA_FORMAT_LABELS[release.mediaFormat]}
                      {release.projectTitle ? ` · ${release.projectTitle}` : ""}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold tabular-nums">
                        {formatPrice(release.retailPriceCents)}
                      </span>
                      <Badge
                        className="text-[9px]"
                        variant={
                          release.status === "published" ? "default" : "outline"
                        }
                      >
                        {release.status}
                      </Badge>
                    </div>
                    {release.kunakiProductId ? null : (
                      <p className="text-destructive text-[10px]">
                        Needs Kunaki product ID
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Apparel & Merch (Printful) — horizontal scroll */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-black text-lg uppercase tracking-tight">
              Apparel & Merch
            </h2>
            <Badge className="text-[10px]" variant="outline">
              {designs.length}
            </Badge>
          </div>
          <Button
            onClick={() => setIsCreatingApparel(!isCreatingApparel)}
            size="sm"
            variant="outline"
          >
            <Plus className="mr-2 size-4" />
            {isCreatingApparel ? "Close" : "New design"}
          </Button>
        </div>
        {isCreatingApparel ? (
          <MerchDesigner
            products={catalogData?.products ?? []}
            variants={catalogData?.variants ?? []}
          />
        ) : null}
        {designsLoading ? (
          <p className="text-muted-foreground text-sm">Loading designs…</p>
        ) : designs.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
              <Shirt className="size-8" />
              <div>
                <p className="text-sm font-semibold">No merch designs yet</p>
                <p className="text-xs">
                  Upload artwork, pick a blank, set your price — Printful
                  handles the rest.
                </p>
              </div>
              {!isCreatingApparel ? (
                <Button onClick={() => setIsCreatingApparel(true)} size="sm">
                  <Plus className="mr-2 size-4" />
                  Create a design
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="scrollbar-thin overflow-x-auto pb-2">
            <div className="flex gap-3">
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
    [selectedProductId, setSelectedProductId] = useState(""),
    [placement, setPlacement] = useState("front"),
    [retailPrice, setRetailPrice] = useState(""),
    [designFileUrl, setDesignFileUrl] = useState(""),
    [projectId, setProjectId] = useState(""),
    [trackId, setTrackId] = useState(""),
    createDesign = useCreateMerchDesignMutation(),
    selectedProduct = products.find((p) => p.id === selectedProductId),
    selectedVariants = variants.filter(
      (v) => v.catalogProductId === selectedProductId
    ),
    baseCost =
      selectedVariants.length > 0
        ? Math.min(...selectedVariants.map((v) => v.basePriceCents))
        : 0,
    retailPriceCents = Math.round(Number(retailPrice) * 100) || 0,
    platformCut = Math.round(retailPriceCents * 0.12),
    artistPayout = retailPriceCents - platformCut - baseCost,
    placements = (selectedProduct?.placements ?? [])
      .map((p) => p.placement as string)
      .filter(Boolean),
    handleCreate = () => {
      if (
        !title.trim() ||
        !selectedProductId ||
        !designFileUrl.trim() ||
        retailPriceCents < (selectedProduct?.retailMinCents ?? 1200)
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
                ${((retailPriceCents - baseCost) / 100).toFixed(2)} after blank
                cost (${(baseCost / 100).toFixed(2)}) minus 12% platform fee ($
                {(platformCut / 100).toFixed(2)}). Shipping is pass-through.
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
  const { toast } = useToast(),
    updateDesign = useUpdateMerchDesignMutation(),
    deleteDesign = useDeleteMerchDesignMutation(),
    { data: mockups = [] } = useMerchDesignMockupsQuery(
      isSelected ? design.id : null
    ),
    completedMockups = mockups.filter((m) => m.status === "completed");

  return (
    <div
      className={`w-44 shrink-0 cursor-pointer overflow-hidden rounded-lg border transition-all ${
        isSelected
          ? "border-primary ring-primary/30 ring-2"
          : "border-border/40 hover:border-border/60 hover:shadow-lg"
      }`}
      onClick={onSelect}
    >
      <div className="bg-muted relative aspect-square overflow-hidden">
        {completedMockups.length > 0 ? (
          <AppImage
            alt={`${design.title} mockup`}
            className="size-full object-cover"
            height={240}
            src={completedMockups[0]?.mockupUrl ?? ""}
            width={240}
          />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
            {design.mockupCount > 0
              ? `Generating ${design.mockupCount}…`
              : "No mockups"}
          </div>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <p className="truncate text-sm font-semibold">{design.title}</p>
        <div className="flex items-center justify-between">
          <span className="font-semibold tabular-nums">
            {formatPrice(design.retailPriceCents)}
          </span>
          <span className="text-muted-foreground text-[10px]">
            {design.readyMockupCount}/{design.mockupCount} ready
          </span>
        </div>
        <div className="flex items-center justify-between">
          <Badge
            className="text-[9px]"
            variant={design.status === "published" ? "default" : "outline"}
          >
            {design.status}
          </Badge>
          <div className="flex gap-1">
            {design.status === "published" ? (
              <Button
                className="h-6 px-2 text-[10px]"
                onClick={(e) => {
                  e.stopPropagation();
                  updateDesign.mutate({ id: design.id, status: "draft" });
                }}
                size="sm"
                variant="outline"
              >
                Unpublish
              </Button>
            ) : (
              <Button
                className="h-6 px-2 text-[10px]"
                disabled={
                  design.readyMockupCount === 0 || updateDesign.isPending
                }
                onClick={(e) => {
                  e.stopPropagation();
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
                          description: `"${design.title}" is live.`,
                          title: "Published",
                        }),
                    }
                  );
                }}
                size="sm"
              >
                Publish
              </Button>
            )}
            <Button
              aria-label={`Delete ${design.title}`}
              className="h-6 size-6"
              onClick={(e) => {
                e.stopPropagation();
                deleteDesign.mutate(design.id, {
                  onSuccess: () =>
                    toast({
                      description: `"${design.title}" archived.`,
                      title: "Deleted",
                    }),
                });
              }}
              size="icon"
              variant="ghost"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
        {isSelected && completedMockups.length > 0 ? (
          <div className="border-border/30 mt-2 space-y-1 border-t pt-2">
            <p className="text-muted-foreground text-[9px] font-semibold uppercase tracking-wide">
              Mockup gallery
            </p>
            <div className="flex gap-1 overflow-x-auto">
              {completedMockups.slice(0, 8).map((m) => (
                <div
                  className="relative h-14 w-14 shrink-0 overflow-hidden rounded border border-border/30"
                  key={m.id}
                >
                  <AppImage
                    alt="mockup"
                    className="size-full object-cover"
                    height={56}
                    src={m.mockupUrl ?? ""}
                    width={56}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
