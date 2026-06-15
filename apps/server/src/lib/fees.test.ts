import { describe, expect, it } from "vitest";

import {
  calculateFeeCents,
  COMMUNITY_PLATFORM_FEE_BPS,
  PRODUCT_PLATFORM_FEE_BPS,
  TIP_PLATFORM_FEE_BPS,
} from "./fees";

describe("payment fees", () => {
  it("uses the configured basis point rates", () => {
    expect(PRODUCT_PLATFORM_FEE_BPS).toBe(1000);
    expect(COMMUNITY_PLATFORM_FEE_BPS).toBe(1000);
    expect(TIP_PLATFORM_FEE_BPS).toBe(500);
  });

  it("rounds fees to integer cents", () => {
    expect(calculateFeeCents({ amountCents: 1499, basisPoints: 1000 })).toBe(
      150
    );
    expect(calculateFeeCents({ amountCents: 299, basisPoints: 500 })).toBe(15);
  });

  it("handles zero and the full basis-point range", () => {
    expect(calculateFeeCents({ amountCents: 0, basisPoints: 1000 })).toBe(0);
    expect(calculateFeeCents({ amountCents: 499, basisPoints: 0 })).toBe(0);
    expect(calculateFeeCents({ amountCents: 499, basisPoints: 10_000 })).toBe(
      499
    );
  });

  it.each([
    { amountCents: -1, basisPoints: 1000 },
    { amountCents: 100, basisPoints: -1 },
    { amountCents: 100, basisPoints: 10_001 },
    { amountCents: 10.5, basisPoints: 1000 },
    { amountCents: 100, basisPoints: 10.5 },
  ])("rejects invalid fee inputs: $amountCents/$basisPoints", (input) => {
    expect(() => calculateFeeCents(input)).toThrow(
      "Invalid fee calculation input."
    );
  });
});
