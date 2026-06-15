export const getSingleCheckoutSellerId = (
  sellerIds: (string | null | undefined)[]
) => {
  const uniqueSellerIds = [...new Set(sellerIds.filter(Boolean))];

  return uniqueSellerIds.length === 1 ? uniqueSellerIds[0] : null;
};
