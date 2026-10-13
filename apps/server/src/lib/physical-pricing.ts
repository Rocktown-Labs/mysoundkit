import type { PhysicalMediaFormat } from "@soundkit/db/schema/commerce";

import { BASIS_POINTS_TOTAL } from "./fees";

export const PHYSICAL_PLATFORM_FEE_BPS = 1200; // 12%

export interface PhysicalFormatRule {
  defaultRetailCents: number;
  label: string;
  manufacturingBaseCents: number;
  maxRetailCents: number;
  minRetailCents: number;
}

export const PHYSICAL_FORMAT_RULES: Record<
  PhysicalMediaFormat,
  PhysicalFormatRule
> = {
  cd: {
    defaultRetailCents: 1500, // $15.00
    label: "Audio CD (Standard Jewel Case)",
    manufacturingBaseCents: 175, // $1.75
    maxRetailCents: 2500, // $25.00
    minRetailCents: 1000, // $10.00
  },
  dvd: {
    defaultRetailCents: 1800, // $18.00
    label: "Video DVD (Amaray Case)",
    manufacturingBaseCents: 190, // $1.90
    maxRetailCents: 3000, // $30.00
    minRetailCents: 1200, // $12.00
  },
  vinyl_12: {
    defaultRetailCents: 5500, // $55.00
    label: '12" Vinyl Record',
    manufacturingBaseCents: 3600, // $36.00
    maxRetailCents: 6500, // $65.00
    minRetailCents: 4800, // $48.00
  },
  vinyl_7: {
    defaultRetailCents: 2800, // $28.00
    label: '7" Vinyl Record',
    manufacturingBaseCents: 1500, // $15.00
    maxRetailCents: 3500, // $35.00
    minRetailCents: 2200, // $22.00
  },
};

export const validatePhysicalRetailPrice = ({
  mediaFormat,
  retailPriceCents,
}: {
  mediaFormat: PhysicalMediaFormat;
  retailPriceCents: number;
}): { valid: boolean; error?: string } => {
  const rule = PHYSICAL_FORMAT_RULES[mediaFormat];
  if (!rule) {
    return { error: `Unsupported media format: ${mediaFormat}`, valid: false };
  }

  if (
    !Number.isInteger(retailPriceCents) ||
    retailPriceCents < rule.minRetailCents ||
    retailPriceCents > rule.maxRetailCents
  ) {
    const minFormatted = (rule.minRetailCents / 100).toFixed(2),
      maxFormatted = (rule.maxRetailCents / 100).toFixed(2);
    return {
      error: `${rule.label} retail price must be between $${minFormatted} and $${maxFormatted}.`,
      valid: false,
    };
  }

  return { valid: true };
};

export interface PhysicalPricingBreakdown {
  applicationFeeCents: number;
  artistPayoutCents: number;
  currency: string;
  manufacturingBaseCents: number;
  mediaFormat: PhysicalMediaFormat;
  platformCutCents: number;
  platformFeeBps: number;
  quantity: number;
  retailPriceCents: number;
  shippingFeeCents: number;
  totalFanChargeCents: number;
  unitManufacturingBaseCents: number;
  unitRetailPriceCents: number;
}

/**
 * Computes exact unit economics for physical merchandise.
 * SoundKit Retains: Manufacturing Base + Shipping Fee + 12% Platform Cut
 * Artist Receives: Retail Price - (Manufacturing Base + 12% Platform Cut)
 * Shipping is strictly pass-through so platform never absorbs shipping shortfalls.
 */
export const calculatePhysicalPricing = ({
  currency = "USD",
  mediaFormat,
  quantity = 1,
  retailPriceCents,
  shippingFeeCents = 0,
}: {
  currency?: string;
  mediaFormat: PhysicalMediaFormat;
  quantity?: number;
  retailPriceCents: number;
  shippingFeeCents?: number;
}): PhysicalPricingBreakdown => {
  const validation = validatePhysicalRetailPrice({
    mediaFormat,
    retailPriceCents,
  });
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer.");
  }

  if (!Number.isInteger(shippingFeeCents) || shippingFeeCents < 0) {
    throw new Error("Shipping fee must be a non-negative integer in cents.");
  }

  const rule = PHYSICAL_FORMAT_RULES[mediaFormat],
    unitRetailPriceCents = retailPriceCents,
    unitManufacturingBaseCents = rule.manufacturingBaseCents,
    totalRetailCents = unitRetailPriceCents * quantity,
    totalMfgBaseCents = unitManufacturingBaseCents * quantity,
    platformCutCents = Math.round(
      (totalRetailCents * PHYSICAL_PLATFORM_FEE_BPS) / BASIS_POINTS_TOTAL
    ),
    artistPayoutCents =
      totalRetailCents - (totalMfgBaseCents + platformCutCents),
    applicationFeeCents =
      totalMfgBaseCents + shippingFeeCents + platformCutCents,
    totalFanChargeCents = totalRetailCents + shippingFeeCents;

  // Invariant verification: fan total minus application fee must exactly equal artist payout
  if (totalFanChargeCents - applicationFeeCents !== artistPayoutCents) {
    throw new Error("Physical pricing split balance invariant violation.");
  }

  return {
    applicationFeeCents,
    artistPayoutCents,
    currency,
    manufacturingBaseCents: totalMfgBaseCents,
    mediaFormat,
    platformCutCents,
    platformFeeBps: PHYSICAL_PLATFORM_FEE_BPS,
    quantity,
    retailPriceCents: totalRetailCents,
    shippingFeeCents,
    totalFanChargeCents,
    unitManufacturingBaseCents,
    unitRetailPriceCents,
  };
};
