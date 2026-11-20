/* eslint-disable one-var, sort-vars, complexity -- Keep editor state and derived values in dependency order. */
import { useUploadFiles } from "@better-upload/client";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ImagePlus, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppImage } from "@/components/ui/app-image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MEDIA_BASE_URL, MEDIA_UPLOAD_URL } from "@/lib/api";
import {
  useCreateMerchDesignMutation,
  useUpdateMerchDesignMutation,
} from "@/lib/soundkit-api-hooks";
import type {
  MerchCatalogProduct,
  MerchCatalogVariant,
  MerchDesign,
} from "@/lib/soundkit-api-hooks";

import {
  fitMerchArtwork,
  clampMerchPosition,
} from "../../../../../packages/db/src/merch-design";
import type {
  MerchEditorConfig,
  MerchPosition,
} from "../../../../../packages/db/src/merch-design";
import { MerchDiscardDialog } from "./merch-discard-dialog";
import { MerchEditorCanvas } from "./merch-editor-canvas";
import { MerchProductReview } from "./merch-product-review";

export function MerchDesigner({
  products,
  variants,
  initialProductId,
  initialVariantId,
  onCreated,
  onPublished,
  design,
  onDirtyChange,
}: {
  products: MerchCatalogProduct[];
  variants: MerchCatalogVariant[];
  initialProductId: string;
  initialVariantId?: string;
  onCreated: () => void;
  onPublished?: (design: MerchDesign) => void;
  design?: MerchDesign;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const product = products.find((item) => item.id === initialProductId);
  const available = variants.filter(
    (item) => item.catalogProductId === initialProductId && item.inStock
  );
  const previewColors = [
    ...new Map(
      available.map((item) => [item.color ?? "Default", item])
    ).values(),
  ];
  const preferredPreviewVariant =
    initialVariantId ?? design?.editorConfig?.variantIds[0];
  const areas = product?.printAreas ?? [];
  const [areaKey, setAreaKey] = useState(
    design?.placement ?? areas[0]?.placement ?? ""
  );
  const area = areas.find((item) => item.placement === areaKey);
  const [title, setTitle] = useState(design?.title ?? "");
  const [description, setDescription] = useState(design?.description ?? "");
  const [price, setPrice] = useState(
    design
      ? String(design.retailPriceCents / 100)
      : String((product?.retailMinCents ?? 2500) / 100)
  );
  const [artwork, setArtwork] = useState(design?.editorConfig?.artwork ?? null);
  const [objectKey, setObjectKey] = useState(design?.designFileObjectKey ?? "");
  const [preview, setPreview] = useState(design?.designFileUrl ?? "");
  const [position, setPosition] = useState<MerchPosition | null>(
    design?.editorConfig?.position ?? null
  );
  const [variantIds, setVariantIds] = useState(
    design?.editorConfig?.variantIds ??
      available.slice(0, 250).map((item) => item.id)
  );
  const [previewVariant, setPreviewVariant] = useState(
    available.some((item) => item.id === preferredPreviewVariant)
      ? (preferredPreviewVariant ?? "")
      : (available[0]?.id ?? "")
  );
  const [saved, setSaved] = useState<MerchDesign | undefined>(design);
  const [stage, setStage] = useState<"design" | "review">(
    design ? "review" : "design"
  );
  const [discardOpen, setDiscardOpen] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const { uploadAsync, isPending: uploading } = useUploadFiles({
    api: MEDIA_UPLOAD_URL,
    credentials: "include",
    route: "media",
  });
  const create = useCreateMerchDesignMutation();
  const update = useUpdateMerchDesignMutation();
  const client = useQueryClient();
  const { toast } = useToast();
  const pending =
    uploading || isReading || create.isPending || update.isPending;
  const locked =
    Boolean(saved?.publishedAt) ||
    saved?.status === "published" ||
    saved?.status === "archived";
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  const setEditedPosition = (value: MerchPosition) => {
    setPosition(value);
    setDirty(true);
  };
  const setColorIncluded = (color: string, included: boolean) => {
    const group = available.filter(
        (item) => (item.color ?? "Default") === color
      ),
      groupIds = new Set(group.map((item) => item.id));
    if (included) {
      const additions = group.filter((item) => !variantIds.includes(item.id));
      if (variantIds.length + additions.length > 250) {
        setError(
          "A design can include up to 250 variants. Remove some sizes before adding this color."
        );
        return;
      }
      setVariantIds([...variantIds, ...additions.map((item) => item.id)]);
      const [previewColorVariant] = group;
      if (previewColorVariant) {
        setPreviewVariant(previewColorVariant.id);
      }
    } else {
      const remainingVariantIds = variantIds.filter((id) => !groupIds.has(id));
      setVariantIds(remainingVariantIds);
      if (groupIds.has(previewVariant)) {
        const nextPreviewVariant = available.find((item) =>
          remainingVariantIds.includes(item.id)
        );
        setPreviewVariant(nextPreviewVariant?.id ?? "");
      }
    }
    setError("");
    setDirty(true);
  };
  const pickArtwork = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    event.target.value = "";
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > 20 * 1024 * 1024
    ) {
      setError("Choose a PNG or JPEG image under 20 MB.");
      return;
    }
    generation.current += 1;
    const revision = generation.current;
    setIsReading(true);
    setDirty(true);
    setError("");
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { height: bitmap.height, width: bitmap.width };
      bitmap.close();
      if (dimensions.width > 30_000 || dimensions.height > 30_000) {
        setError("Use artwork smaller than 30,000 pixels on each side.");
        setIsReading(false);
        return;
      }
      const result = await uploadAsync([file]);
      const [uploaded] = result.files;
      if (!uploaded || revision !== generation.current) {
        return;
      }
      const { key } = uploaded.objectInfo;
      setObjectKey(key);
      setPreview(`${MEDIA_BASE_URL}/${key}`);
      setArtwork(dimensions);
      setDirty(true);
      if (area) {
        setPosition(fitMerchArtwork(area, dimensions));
      }
    } catch (error_) {
      if (revision === generation.current) {
        setError(
          error_ instanceof Error
            ? error_.message
            : "Artwork upload failed. Try again."
        );
      }
    }
    if (revision === generation.current) {
      setIsReading(false);
    }
  };
  const save = async () => {
    if (!product || !area || !position || !artwork || !objectKey) {
      setError("Upload artwork and choose a supported print area.");
      return;
    }
    const cents = Math.round(Number(price) * 100);
    if (
      !title.trim() ||
      cents < product.retailMinCents ||
      cents > product.retailMaxCents ||
      !Number.isFinite(cents) ||
      !variantIds.length
    ) {
      setError(
        "Add a name, select variants and choose a price within the allowed range."
      );
      return;
    }
    const dpi = Math.min(
      artwork.width / position.width,
      artwork.height / position.height
    );
    if (dpi < area.dpi) {
      setError(
        `Artwork is ${Math.floor(dpi)} DPI. Reduce its print size or upload a larger image to reach ${area.dpi} DPI.`
      );
      return;
    }
    const config: MerchEditorConfig = {
      artwork,
      position,
      printArea: area,
      variantIds,
      version: 1,
    };
    const body = {
      description,
      designFileObjectKey: objectKey,
      editorConfig: config,
      placement: area.placement,
      retailPriceCents: cents,
      technique: area.technique,
      title: title.trim(),
    };
    setError("");
    try {
      const response = saved
        ? await update.mutateAsync({ id: saved.id, ...body })
        : await create.mutateAsync({
            printfulCatalogProductId: product.id,
            ...body,
          });
      if (
        !response ||
        typeof response !== "object" ||
        !("id" in response) ||
        typeof response.id !== "string"
      ) {
        setError("The design could not be saved.");
        return;
      }
      setSaved({ ...body, ...response, id: response.id } as MerchDesign);
      setDirty(false);
      setStage("review");
      toast({
        description: "Your product is private while mockups are generated.",
        title: "Draft saved",
      });
    } catch (error_) {
      setError(
        error_ instanceof Error
          ? error_.message
          : "Saving failed. Your edits are still here."
      );
    }
  };
  const done = () => {
    void client.invalidateQueries({ queryKey: ["merch", "designs"] });
    onCreated();
  };
  if (stage === "review" && saved) {
    return (
      <MerchProductReview
        design={saved}
        product={product}
        variants={available}
        onDone={done}
        onPublished={onPublished}
        onDirtyChange={onDirtyChange}
        onEdit={
          !locked && saved.editorConfig && area
            ? () => setStage("design")
            : undefined
        }
      />
    );
  }
  if (!product || !area) {
    return (
      <Alert>
        <AlertDescription>
          This product’s print template isn’t available yet. Choose another
          product or try again after the catalog is refreshed.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <MerchDiscardDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onDiscard={() => {
          if (!saved) {
            return;
          }
          setTitle(saved.title);
          setDescription(saved.description ?? "");
          setPrice(String(saved.retailPriceCents / 100));
          setObjectKey(saved.designFileObjectKey);
          setPreview(saved.designFileUrl ?? "");
          setArtwork(saved.editorConfig?.artwork ?? null);
          setPosition(saved.editorConfig?.position ?? null);
          setVariantIds(saved.editorConfig?.variantIds ?? []);
          setAreaKey(saved.placement);
          setDirty(false);
          setStage("review");
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h3 className="text-xl font-semibold">{product.name}</h3>
          <p className="text-sm text-muted-foreground">
            Design <span aria-hidden="true">→</span> Product details{" "}
            <span aria-hidden="true">→</span> Publish
          </p>
        </div>
        {saved && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (dirty) {
                setDiscardOpen(true);
              } else {
                setStage("review");
              }
            }}
          >
            <ArrowLeft />
            Saved product
          </Button>
        )}
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_260px]">
        <aside className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="merch-artwork">Artwork</Label>
            <Input
              ref={fileInput}
              id="merch-artwork"
              type="file"
              accept="image/png,image/jpeg"
              disabled={pending}
              onChange={(event) => {
                void pickArtwork(event);
              }}
            />
            <p className="text-xs text-muted-foreground">
              PNG with transparency or JPEG. Up to 20 MB. Use the highest
              resolution original.
            </p>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus />
              {pending ? "Preparing artwork…" : "Upload artwork"}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="merch-placement">Print placement</Label>
            <Select
              value={areaKey}
              onValueChange={(value) => {
                const next = areas.find((item) => item.placement === value);
                if (next && artwork) {
                  setPosition(fitMerchArtwork(next, artwork));
                }
                setAreaKey(value);
                setDirty(true);
              }}
              disabled={pending}
            >
              <SelectTrigger id="merch-placement">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {areas.map((item) => (
                    <SelectItem
                      key={`${item.placement}-${item.technique}`}
                      value={item.placement}
                    >
                      {item.placement.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <AppImage
              src={
                available.find((item) => item.id === previewVariant)?.image ??
                product.image
              }
              alt={product.name}
              width={100}
              height={140}
              className="h-28 w-20 object-contain"
            />
            <p className="text-xs text-muted-foreground">
              Blank reference. Generate mockups to see your finished product.
            </p>
          </div>
          {previewColors.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Colors to sell</legend>
              <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                {previewColors.map((item) => {
                  const color = item.color ?? "Default",
                    colorVariants = available.filter(
                      (variant) => (variant.color ?? "Default") === color
                    ),
                    selectedCount = colorVariants.filter((variant) =>
                      variantIds.includes(variant.id)
                    ).length,
                    isIncluded = selectedCount === colorVariants.length,
                    isPartiallyIncluded = selectedCount > 0 && !isIncluded,
                    isPreviewed = colorVariants.some(
                      (variant) => variant.id === previewVariant
                    ),
                    swatchColor = item.colorCode?.replace(/^#/u, ""),
                    isHexColor = Boolean(
                      swatchColor && /^[\da-f]{6}$/iu.test(swatchColor)
                    );
                  return (
                    <div
                      className={`flex items-center gap-2 rounded-md border p-2 ${isPreviewed ? "border-primary" : "border-border"}`}
                      key={item.id}
                    >
                      <Checkbox
                        aria-label={`Include ${color}`}
                        checked={
                          isPartiallyIncluded ? "indeterminate" : isIncluded
                        }
                        disabled={pending}
                        onCheckedChange={(checked) =>
                          setColorIncluded(color, checked === true)
                        }
                      />
                      <button
                        aria-label={`Preview ${color}`}
                        aria-pressed={isPreviewed}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
                        onClick={() => setPreviewVariant(item.id)}
                        title={`Preview ${color}`}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className="size-6 shrink-0 rounded-full border border-foreground/20 bg-muted"
                          style={
                            isHexColor
                              ? { backgroundColor: `#${swatchColor}` }
                              : undefined
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">{color}</span>
                        <span className="text-xs text-muted-foreground">
                          {selectedCount}/{colorVariants.length}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Select colors to sell, preview each blank, then adjust sizes
                below.
              </p>
            </fieldset>
          )}
        </aside>
        <div className="flex min-h-80 items-center justify-center rounded-lg bg-muted/30 p-5">
          {preview && position ? (
            <MerchEditorCanvas
              src={preview}
              area={area}
              position={position}
              onChange={setEditedPosition}
              disabled={pending}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <ImagePlus className="size-10 text-muted-foreground" />
              <p>Start with your artwork</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Your logo, cover art, or next tour graphic. Position it inside
                the print area, then review the generated mockups.
              </p>
            </div>
          )}
        </div>
        <aside className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="merch-title">Product name</Label>
            <Input
              id="merch-title"
              maxLength={200}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setDirty(true);
              }}
              placeholder="Midnight Tour tee"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="merch-price">Selling price (USD)</Label>
            <Input
              id="merch-price"
              type="number"
              min={product.retailMinCents / 100}
              max={product.retailMaxCents / 100}
              step="0.01"
              value={price}
              onChange={(event) => {
                setPrice(event.target.value);
                setDirty(true);
              }}
            />
            <p className="text-xs text-muted-foreground">
              ${(product.retailMinCents / 100).toFixed(2)}–$
              {(product.retailMaxCents / 100).toFixed(2)}
            </p>
          </div>
          {position && artwork && (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 text-sm font-medium">
                Artwork position (inches)
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {["left", "top", "width"].map((name) => {
                  const key = name as "left" | "top" | "width";
                  return (
                    <div key={key} className="flex flex-col gap-1">
                      <Label htmlFor={`merch-${key}`} className="capitalize">
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </Label>
                      <Input
                        id={`merch-${key}`}
                        type="number"
                        step="0.05"
                        min={key === "width" ? 0.01 : 0}
                        value={Number(position[key].toFixed(3))}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isFinite(value)) {
                            return;
                          }
                          let next = { ...position, [key]: value };
                          if (key === "width") {
                            const width = Math.max(
                              0.01,
                              Math.min(
                                value,
                                area.width,
                                (area.height * artwork.width) / artwork.height
                              )
                            );
                            next = {
                              ...position,
                              height: (width * artwork.height) / artwork.width,
                              width,
                            };
                          }
                          setEditedPosition(clampMerchPosition(next, area));
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.floor(
                  Math.min(
                    artwork.width / position.width,
                    artwork.height / position.height
                  )
                )}{" "}
                DPI at this size. Aspect ratio locked.
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  setEditedPosition(fitMerchArtwork(area, artwork))
                }
              >
                <RotateCcw />
                Center & fit
              </Button>
            </fieldset>
          )}
        </aside>
      </div>
      <div className="grid gap-5 border-t pt-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="merch-description">Description</Label>
          <Textarea
            id="merch-description"
            maxLength={2000}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setDirty(true);
            }}
            placeholder="Tell the story behind this drop."
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            Available variants ({variantIds.length} selected)
          </legend>
          <div className="flex max-h-40 flex-wrap gap-3 overflow-y-auto">
            {available.map((variant) => (
              <Label
                key={variant.id}
                className="flex items-center gap-2 rounded-md border p-2"
              >
                <Checkbox
                  checked={variantIds.includes(variant.id)}
                  disabled={
                    pending ||
                    (!variantIds.includes(variant.id) &&
                      variantIds.length >= 250)
                  }
                  onCheckedChange={(checked) => {
                    setVariantIds(
                      checked
                        ? [...variantIds, variant.id]
                        : variantIds.filter((id) => id !== variant.id)
                    );
                    setDirty(true);
                  }}
                />
                {variant.name}
              </Label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          Saved as a private draft. Review mockups before publishing.
        </p>
        <Button
          onClick={() => {
            void save();
          }}
          disabled={pending || !artwork || !position || !variantIds.length}
        >
          {pending ? "Saving…" : "Save & review"}
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
