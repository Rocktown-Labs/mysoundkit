import { describe, expect, it } from "vitest";

import * as appSchema from "./app";
import { fulfillmentProviderEnum } from "./commerce";
import {
  merchCatalogProducts,
  merchCatalogVariants,
  merchDesigns,
  merchFulfillments,
  merchMockups,
  merchShipments,
  merchStatusEnum,
  mockupTaskStatusEnum,
  orderShippingSelections,
} from "./fulfillment";

describe("printful merch schema", () => {
  it("defines merch design and mockup task statuses", () => {
    expect(merchStatusEnum.enumValues).toEqual([
      "draft",
      "ready",
      "published",
      "archived",
    ]);
    expect(mockupTaskStatusEnum.enumValues).toEqual([
      "queued",
      "pending",
      "completed",
      "failed",
    ]);
  });

  it("extends shared enums for printful fulfillment and webhooks", () => {
    expect(appSchema.physicalFulfillmentStatusEnum.enumValues).toContain(
      "printful_processing"
    );
    expect(appSchema.webhookProviderEnum.enumValues).toContain("printful");
    expect(fulfillmentProviderEnum.enumValues).toContain("printful");
  });

  it("models merch designs as standalone-first with optional links", () => {
    expect(merchDesigns.projectId.notNull).toBe(false);
    expect(merchDesigns.trackId.notNull).toBe(false);
    expect(merchDesigns.printfulCatalogProductId.notNull).toBe(false);
    expect(merchDesigns.platformFeeBps.default).toBe(1200);
    expect(merchDesigns.status.default).toBe("draft");
    expect(merchDesigns.technique.default).toBe("dtg");
    expect(merchDesigns.designFileObjectKey.notNull).toBe(true);
    expect(merchDesigns.retailPriceCents.notNull).toBe(true);
  });

  it("snapshots curated catalog data with pricing bounds", () => {
    expect(merchCatalogProducts.retailMinCents.notNull).toBe(true);
    expect(merchCatalogProducts.retailMaxCents.notNull).toBe(true);
    expect(merchCatalogProducts.isCurated.default).toBe(true);
    expect(merchCatalogProducts.isDiscontinued.default).toBe(false);
    expect(merchCatalogVariants.basePriceCents.notNull).toBe(true);
    expect(merchCatalogVariants.inStock.default).toBe(true);
  });

  it("keeps printful fulfillment records isolated per order", () => {
    expect(merchFulfillments.orderId.notNull).toBe(true);
    expect(merchFulfillments.externalId.notNull).toBe(true);
    expect(merchFulfillments.printfulOrderId.notNull).toBe(false);
    expect(merchFulfillments.status.default).toBe("draft");
    expect(merchShipments.fulfillmentId.notNull).toBe(true);
    expect(merchShipments.isReshipment.default).toBe(false);
    expect(merchShipments.trackingNumber.notNull).toBe(false);
  });

  it("records one shipping selection per provider per order", () => {
    expect(orderShippingSelections.provider.notNull).toBe(true);
    expect(orderShippingSelections.priceCents.notNull).toBe(true);
    expect(orderShippingSelections.optionCode.notNull).toBe(true);
    expect(orderShippingSelections.label.notNull).toBe(true);
    expect(orderShippingSelections.orderId.notNull).toBe(true);
  });

  it("binds merch variants and mockups to designs and carts", () => {
    expect(merchMockups.merchDesignId.notNull).toBe(true);
    expect(merchMockups.catalogVariantId.notNull).toBe(true);
    expect(merchMockups.status.default).toBe("queued");
    expect(appSchema.cartItems.merchDesignId.notNull).toBe(false);
    expect(appSchema.cartItems.printfulVariantId.notNull).toBe(false);
    expect(appSchema.orderItems.merchDesignId.notNull).toBe(false);
    expect(appSchema.orderItems.printfulVariantId.notNull).toBe(false);
  });
});
