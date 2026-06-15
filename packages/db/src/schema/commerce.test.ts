import { describe, expect, it } from "vitest";

import * as appSchema from "./app";
import { fulfillmentProviderEnum, sellableProducts } from "./commerce";
import {
  communityPostTypeEnum,
  communitySubscriptionStatusEnum,
} from "./communities";
import { payoutRecords, transactions } from "./payments";

describe("fulfillment providers", () => {
  it("reserves Printful without exposing provider behavior", () => {
    expect(fulfillmentProviderEnum.enumValues).toEqual([
      "none",
      "manual",
      "printful",
    ]);
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
