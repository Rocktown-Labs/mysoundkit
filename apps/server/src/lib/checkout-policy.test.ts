import { describe, expect, it } from "vitest";

import { getSingleCheckoutSellerId } from "./checkout-policy";

describe("checkout seller policy", () => {
  it("accepts repeated products from one artist", () => {
    expect(getSingleCheckoutSellerId(["artist_1", "artist_1"])).toBe(
      "artist_1"
    );
  });

  it("rejects carts that mix artists", () => {
    expect(getSingleCheckoutSellerId(["artist_1", "artist_2"])).toBeNull();
  });

  it("rejects carts without an attributable artist", () => {
    expect(getSingleCheckoutSellerId([null, undefined])).toBeNull();
  });
});
