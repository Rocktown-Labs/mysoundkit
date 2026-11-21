/* eslint-disable one-var, sort-vars -- Keep validation stages in dependency order. */
import type {
  MerchEditorConfig,
  MerchPrintArea,
} from "@soundkit/db/merch-design";
import { z } from "zod";

export class MerchEditorError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MerchEditorError";
  }
}

export const merchEditorSchema = z.object({
  artwork: z.object({
    height: z.number().int().positive().max(30_000),
    width: z.number().int().positive().max(30_000),
  }),
  position: z.object({
    height: z.number().positive(),
    left: z.number().min(0),
    top: z.number().min(0),
    width: z.number().positive(),
  }),
  printArea: z.object({
    dpi: z.number().positive(),
    height: z.number().positive(),
    placement: z.string(),
    technique: z.literal("dtg"),
    width: z.number().positive(),
  }),
  variantIds: z
    .array(z.string().min(1))
    .min(1)
    .max(250)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Select each variant only once."
    ),
  version: z.literal(1),
});

export function merchPrintAreas(
  rules: Record<string, unknown> | null
): MerchPrintArea[] {
  const placements = rules?.placements;
  if (!Array.isArray(placements)) {
    return [];
  }
  return placements.flatMap((value: unknown) => {
    if (!value || typeof value !== "object") {
      return [];
    }
    const p = value as Record<string, unknown>;
    if (
      p.technique !== "dtg" ||
      p.printAreaType !== "simple" ||
      typeof p.placement !== "string" ||
      typeof p.printAreaWidth !== "number" ||
      !(p.printAreaWidth > 0) ||
      typeof p.printAreaHeight !== "number" ||
      !(p.printAreaHeight > 0) ||
      typeof p.dpi !== "number" ||
      !(p.dpi > 0)
    ) {
      return [];
    }
    return [
      {
        dpi: p.dpi,
        height: p.printAreaHeight,
        placement: p.placement,
        technique: p.technique,
        width: p.printAreaWidth,
      },
    ];
  });
}

export function validateMerchEditor({
  config,
  areas,
  variants,
  placement,
  technique,
}: {
  config: MerchEditorConfig;
  areas: MerchPrintArea[];
  variants: { id: string; inStock: boolean }[];
  placement: string;
  technique: string;
}) {
  const area = areas.find(
    (item) => item.placement === placement && item.technique === technique
  );
  if (
    !area ||
    area.width !== config.printArea.width ||
    area.height !== config.printArea.height ||
    area.dpi !== config.printArea.dpi ||
    area.placement !== config.printArea.placement ||
    area.technique !== config.printArea.technique
  ) {
    throw new MerchEditorError(
      "The print area changed. Reload the catalog before saving."
    );
  }
  const { position } = config;
  if (
    position.left + position.width > area.width + 0.00001 ||
    position.top + position.height > area.height + 0.00001
  ) {
    throw new MerchEditorError("Keep artwork inside the print area.");
  }
  const ratio = config.artwork.width / config.artwork.height;
  if (Math.abs(position.width / position.height / ratio - 1) > 0.01) {
    throw new MerchEditorError("Preserve the artwork's aspect ratio.");
  }
  if (
    !config.variantIds.every((id) =>
      variants.some((variant) => variant.id === id && variant.inStock)
    )
  ) {
    throw new MerchEditorError(
      "Some selected variants are unavailable for this product."
    );
  }
  const dpi = Math.min(
    config.artwork.width / position.width,
    config.artwork.height / position.height
  );
  if (dpi < area.dpi) {
    throw new MerchEditorError(
      `Artwork needs at least ${area.dpi} DPI at this print size. Use a larger image or reduce its print size.`
    );
  }
  return config;
}

export function ownedMerchArtwork(key: string, userId: string) {
  return (
    key.startsWith(`uploads/${userId}/`) &&
    !key.includes("..") &&
    !/[?#%\\]/u.test(key)
  );
}

// Both mockup generation and paid fulfillment call this function. Persisted
// inches go directly to Printful; the canvas does not invent garment offsets.
export function merchProductionPlacement(design: {
  designFileUrl: string | null;
  placement: string;
  technique: string;
  designMetadata?: { editor?: MerchEditorConfig } | null;
}) {
  const config = design.designMetadata?.editor;
  return {
    layers: [
      {
        type: "file",
        url: design.designFileUrl ?? "",
        ...(config ? { position: config.position } : {}),
      },
    ],
    placement: design.placement,
    technique: design.technique,
  };
}

export function selectedMerchMockupsReady(
  config: MerchEditorConfig,
  mockups: {
    catalogVariantId: string;
    status: string;
    mockupUrl: string | null;
  }[]
) {
  return config.variantIds.every((id) =>
    mockups.some(
      (mockup) =>
        mockup.catalogVariantId === id &&
        mockup.status === "completed" &&
        Boolean(mockup.mockupUrl)
    )
  );
}
