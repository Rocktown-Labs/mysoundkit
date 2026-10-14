import { describe, expect, it } from "vitest";

import * as appSchema from "./app";
import {
  fulfillmentProviderEnum,
  physicalFulfillmentStatusEnum,
  physicalMediaFormatEnum,
  physicalReleaseStatusEnum,
  physicalReleases,
  sellableProducts,
} from "./commerce";
import {
  communityPostTypeEnum,
  communitySubscriptionStatusEnum,
} from "./communities";
import { payoutRecords, transactions } from "./payments";

describe("fulfillment providers", () => {
  it("reserves Printful and Kunaki providers", () => {
    expect(fulfillmentProviderEnum.enumValues).toEqual([
      "none",
      "manual",
      "printful",
      "kunaki",
    ]);
  });

  it("defines physical media formats and fulfillment statuses", () => {
    expect(physicalMediaFormatEnum.enumValues).toEqual([
      "cd",
      "vinyl_12",
      "vinyl_7",
      "dvd",
    ]);
    expect(physicalReleaseStatusEnum.enumValues).toEqual([
      "draft",
      "ready",
      "published",
      "archived",
    ]);
    expect(physicalFulfillmentStatusEnum.enumValues).toEqual([
      "not_applicable",
      "pending",
      "kunaki_processing",
      "printful_processing",
      "shipped",
      "delivered",
      "cancelled",
      "failed",
    ]);
  });

  it("models physicalReleases with defaults and constraints", () => {
    expect(physicalReleases.includesDigitalDownload.default).toBe(true);
    expect(physicalReleases.platformFeeBps.default).toBe(1200);
    expect(physicalReleases.retailPriceCents.notNull).toBe(true);
    expect(physicalReleases.manufacturingBaseCents.notNull).toBe(true);
    expect(physicalReleases.kunakiProductId.notNull).toBe(false);
  });

  it("tracks physical shipping and fulfillment on orders and order items", () => {
    expect(appSchema.orders.fulfillmentStatus.notNull).toBe(true);
    expect(appSchema.orders.shippingFeeCents.notNull).toBe(true);
    expect(appSchema.orders.shippingFeeCents.default).toBe(0);
    expect(appSchema.orders.kunakiOrderId.notNull).toBe(false);
    expect(appSchema.orders.trackingNumber.notNull).toBe(false);
    expect(appSchema.orderItems.physicalReleaseId.notNull).toBe(false);
    expect(appSchema.cartItems.physicalReleaseId.notNull).toBe(false);
    expect(appSchema.productTypeEnum.enumValues).toContain("physical_merch");
    expect(appSchema.purchaseModeEnum.enumValues).toContain("physical_merch");
  });

  it("keeps fulfillment references nullable on dormant merch products", () => {
    expect(sellableProducts.fulfillmentProvider.notNull).toBe(false);
    expect(sellableProducts.fulfillmentProviderReference.notNull).toBe(false);
  });

  it("keeps payment ledger records separate from music orders", () => {
    expect(appSchema.orders.transactionId.notNull).toBe(false);
    expect(appSchema.orderItems.orderId.notNull).toBe(true);
    expect(payoutRecords.stripePayoutId.notNull).toBe(true);
    expect(transactions.amountCents.notNull).toBe(true);
    expect("transactions" in appSchema).toBe(false);
    expect("payoutRecords" in appSchema).toBe(false);
    expect("communities" in appSchema).toBe(false);
  });

  it("supports all paid community content and access states", () => {
    expect(communityPostTypeEnum.enumValues).toEqual([
      "text",
      "image",
      "audio",
      "video",
      "poll",
    ]);
    expect(communitySubscriptionStatusEnum.enumValues).toEqual([
      "pending",
      "active",
      "past_due",
      "canceled",
      "expired",
    ]);
  });
});
