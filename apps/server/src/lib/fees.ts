export const BASIS_POINTS_TOTAL = 10_000;
export const PRODUCT_PLATFORM_FEE_BPS = 1000;
export const TIP_PLATFORM_FEE_BPS = 500;
export const COMMUNITY_PLATFORM_FEE_BPS = 1000;

export const calculateFeeCents = ({
  amountCents,
  basisPoints,
}: {
  amountCents: number;
  basisPoints: number;
}) => {
  if (
    !Number.isInteger(amountCents) ||
    amountCents < 0 ||
    !Number.isInteger(basisPoints) ||
    basisPoints < 0 ||
    basisPoints > BASIS_POINTS_TOTAL
  ) {
    throw new Error("Invalid fee calculation input.");
  }

  return Math.round((amountCents * basisPoints) / BASIS_POINTS_TOTAL);
};
