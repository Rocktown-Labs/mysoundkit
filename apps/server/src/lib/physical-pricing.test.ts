import { describe, expect, it } from "vitest";

import {
  calculatePhysicalPricing,
  validatePhysicalRetailPrice,
} from "./physical-pricing";

describe("physical pricing economics", () => {
  it("enforces CD pricing bounds ($10.00 - $25.00)", () => {
    expect(
      validatePhysicalRetailPrice({ mediaFormat: "cd", retailPriceCents: 999 })
        .valid
    ).toBe(false);
    expect(
      validatePhysicalRetailPrice({ mediaFormat: "cd", retailPriceCents: 1000 })
        .valid
    ).toBe(true);
    expect(
      validatePhysicalRetailPrice({ mediaFormat: "cd", retailPriceCents: 1500 })
        .valid
    ).toBe(true);
    expect(
      validatePhysicalRetailPrice({ mediaFormat: "cd", retailPriceCents: 2500 })
        .valid
    ).toBe(true);
    expect(
      validatePhysicalRetailPrice({ mediaFormat: "cd", retailPriceCents: 2501 })
        .valid
    ).toBe(false);
  });

  it('enforces 12" Vinyl pricing bounds ($48.00 - $65.00)', () => {
    expect(
      validatePhysicalRetailPrice({
        mediaFormat: "vinyl_12",
        retailPriceCents: 4799,
      }).valid
    ).toBe(false);
    expect(
      validatePhysicalRetailPrice({
        mediaFormat: "vinyl_12",
        retailPriceCents: 4800,
      }).valid
    ).toBe(true);
    expect(
      validatePhysicalRetailPrice({
        mediaFormat: "vinyl_12",
        retailPriceCents: 6500,
      }).valid
    ).toBe(true);
    expect(
      validatePhysicalRetailPrice({
        mediaFormat: "vinyl_12",
        retailPriceCents: 6501,
      }).valid
    ).toBe(false);
  });

  it("calculates exact CD unit economics at default $15.00 price", () => {
    const pricing = calculatePhysicalPricing({
      mediaFormat: "cd",
      quantity: 1,
      retailPriceCents: 1500,
      shippingFeeCents: 450,
    });

    expect(pricing.retailPriceCents).toBe(1500);
    expect(pricing.manufacturingBaseCents).toBe(175);
    expect(pricing.platformCutCents).toBe(180); // 12% of $15.00
    expect(pricing.artistPayoutCents).toBe(1145); // $15.00 - ($1.75 + $1.80)
    expect(pricing.shippingFeeCents).toBe(450);
    expect(pricing.applicationFeeCents).toBe(805); // $1.75 + $4.50 + $1.80
    expect(pricing.totalFanChargeCents).toBe(1950); // $15.00 + $4.50

    // Strict pass-through balance invariant
    expect(pricing.totalFanChargeCents - pricing.applicationFeeCents).toBe(
      pricing.artistPayoutCents
    );
  });

  it('calculates exact 12" Vinyl unit economics at default $55.00 price', () => {
    const pricing = calculatePhysicalPricing({
      mediaFormat: "vinyl_12",
      quantity: 1,
      retailPriceCents: 5500,
      shippingFeeCents: 780,
    });

    expect(pricing.retailPriceCents).toBe(5500);
    expect(pricing.manufacturingBaseCents).toBe(3600);
    expect(pricing.platformCutCents).toBe(660); // 12% of $55.00
    expect(pricing.artistPayoutCents).toBe(1240); // $55.00 - ($36.00 + $6.60)
    expect(pricing.shippingFeeCents).toBe(780);
    expect(pricing.applicationFeeCents).toBe(5040); // $36.00 + $7.80 + $6.60
    expect(pricing.totalFanChargeCents).toBe(6280);

    // Invariant
    expect(pricing.totalFanChargeCents - pricing.applicationFeeCents).toBe(
      pricing.artistPayoutCents
    );
  });

  it("guarantees shipping pass-through without altering artist payout", () => {
    const standardShip = calculatePhysicalPricing({
        mediaFormat: "cd",
        retailPriceCents: 1500,
        shippingFeeCents: 450,
      }),
      expressShip = calculatePhysicalPricing({
        mediaFormat: "cd",
        retailPriceCents: 1500,
        shippingFeeCents: 1800,
      });

    // Artist payout is identical regardless of shipping method
    expect(standardShip.artistPayoutCents).toBe(expressShip.artistPayoutCents);
    expect(standardShip.platformCutCents).toBe(expressShip.platformCutCents);

    // Platform absorbs zero shortfall: application fee absorbs exact shipping difference
    expect(
      expressShip.applicationFeeCents - standardShip.applicationFeeCents
    ).toBe(1800 - 450);
    expect(
      expressShip.totalFanChargeCents - standardShip.totalFanChargeCents
    ).toBe(1800 - 450);
  });

  it("scales correctly across quantities", () => {
    const pricing = calculatePhysicalPricing({
      mediaFormat: "cd",
      quantity: 3,
      retailPriceCents: 1500,
      shippingFeeCents: 600,
    });

    expect(pricing.retailPriceCents).toBe(4500);
    expect(pricing.manufacturingBaseCents).toBe(525); // 3 * 175
    expect(pricing.platformCutCents).toBe(540); // 12% of 4500
    expect(pricing.artistPayoutCents).toBe(3435); // 3 * 1145
    expect(pricing.applicationFeeCents).toBe(1665); // 525 + 600 + 540
    expect(pricing.totalFanChargeCents).toBe(5100);
    expect(pricing.totalFanChargeCents - pricing.applicationFeeCents).toBe(
      pricing.artistPayoutCents
    );
  });
});
