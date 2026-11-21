import type { MerchEditorConfig } from "@soundkit/db/merch-design";
import { fitMerchArtwork, clampMerchPosition } from "@soundkit/db/merch-design";
import { describe, expect, it } from "vitest";

import {
  merchEditorSchema,
  merchPrintAreas,
  merchProductionPlacement,
  ownedMerchArtwork,
  selectedMerchMockupsReady,
  validateMerchEditor,
} from "./merch-production";

const area = {
    dpi: 150,
    height: 10,
    placement: "front",
    technique: "dtg" as const,
    width: 8,
  },
  config: MerchEditorConfig = {
    artwork: { height: 1200, width: 1200 },
    position: { height: 4, left: 2, top: 1, width: 4 },
    printArea: area,
    variantIds: ["black-m"],
    version: 1,
  },
  validate = (value: MerchEditorConfig) =>
    validateMerchEditor({
      areas: [area],
      config: value,
      placement: "front",
      technique: "dtg",
      variants: [{ id: "black-m", inStock: true }],
    });

describe("merch production configuration", () => {
  it("keeps the exact saved inches in both mockup and order placements", () => {
    expect(validate(config)).toEqual(config);
    expect(
      merchProductionPlacement({
        designFileUrl: "https://media.example.test/art.png",
        designMetadata: { editor: config },
        placement: "front",
        technique: "dtg",
      })
    ).toEqual({
      layers: [
        {
          position: { height: 4, left: 2, top: 1, width: 4 },
          type: "file",
          url: "https://media.example.test/art.png",
        },
      ],
      placement: "front",
      technique: "dtg",
    });
    expect(
      merchProductionPlacement({
        designFileUrl: "legacy.png",
        placement: "back",
        technique: "dtg",
      }).layers[0]
    ).not.toHaveProperty("position");
  });
  it.each([
    { ...config, position: { ...config.position, left: 6 } },
    { ...config, position: { ...config.position, height: 2 } },
    { ...config, artwork: { height: 20, width: 20 } },
    { ...config, variantIds: ["another-products-variant"] },
    { ...config, printArea: { ...area, width: 12 } },
  ])("rejects unsupported or unprintable artwork", (value) => {
    expect(() => validate(value)).toThrow();
  });
  it("rejects duplicate variants, negative values and non-finite coordinates", () => {
    expect(
      merchEditorSchema.safeParse({
        ...config,
        variantIds: ["black-m", "black-m"],
      }).success
    ).toBe(false);
    expect(
      merchEditorSchema.safeParse({
        ...config,
        position: { ...config.position, left: -1 },
      }).success
    ).toBe(false);
    expect(
      merchEditorSchema.safeParse({
        ...config,
        position: { ...config.position, width: Infinity },
      }).success
    ).toBe(false);
  });
  it("uses only supported print templates with real dimensions", () => {
    expect(
      merchPrintAreas({
        placements: [
          {
            dpi: 150,
            placement: "front",
            printAreaHeight: 10,
            printAreaType: "simple",
            printAreaWidth: 8,
            technique: "dtg",
          },
        ],
      })
    ).toEqual([area]);
    expect(
      merchPrintAreas({
        placements: [{ placement: "front", technique: "embroidery" }],
      })
    ).toEqual([]);
  });
  it("rejects other users' uploads, URLs and encoded/path traversal keys", () => {
    expect(ownedMerchArtwork("uploads/artist/art.png", "artist")).toBe(true);
    for (const key of [
      "uploads/other/art.png",
      "https://media.example.test/art.png",
      "uploads/artist/../other/art.png",
      "uploads/artist/%2e%2e/art.png",
    ]) {
      expect(ownedMerchArtwork(key, "artist")).toBe(false);
    }
  });
  it("requires a completed image for every selected variant", () => {
    const ready = {
      catalogVariantId: "black-m",
      mockupUrl: "mockup.png",
      status: "completed",
    };
    expect(selectedMerchMockupsReady(config, [ready])).toBe(true);
    expect(
      selectedMerchMockupsReady(
        { ...config, variantIds: ["black-m", "white-l"] },
        [ready]
      )
    ).toBe(false);
    expect(
      selectedMerchMockupsReady(config, [{ ...ready, mockupUrl: null }])
    ).toBe(false);
  });
  it("fits and moves artwork within the true print area without changing its ratio", () => {
    const fit = fitMerchArtwork(area, { height: 600, width: 1200 });
    expect(fit.width / fit.height).toBe(2);
    expect(fit.left + fit.width).toBeLessThanOrEqual(area.width);
    expect(
      clampMerchPosition({ ...fit, left: 200, top: -30 }, area)
    ).toMatchObject({ left: area.width - fit.width, top: 0 });
  });
});
