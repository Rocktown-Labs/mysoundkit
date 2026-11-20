/* eslint-disable one-var -- Keep category lookup definitions separate from population loops. */
const categories: Record<string, "Apparel" | "Accessories" | "Home & living"> =
  {};
for (const type of [
  "TSHIRT",
  "SHIRT",
  "LONGSLEEVE",
  "HOODIE",
  "ZIPHOODIE",
  "SWEATSHIRT",
  "SWEATPANTS",
  "JACKET",
  "PANTS",
  "LEGGINGS",
  "SHORTS",
  "DRESS",
  "TANKTOP",
  "POLO",
  "SKIRT",
  "SWIMWEAR",
  "SPORTSBRA",
  "UNDERWEAR",
]) {
  categories[type] = "Apparel";
}
for (const type of [
  "HAT",
  "CAP",
  "BAG",
  "SOCKS",
  "BEANIE",
  "BACKPACK",
  "TOTEBAG",
  "VISOR",
  "JEWELRY",
]) {
  categories[type] = "Accessories";
}
for (const type of [
  "BOTTLE",
  "MUG",
  "POSTER",
  "STICKER",
  "BLANKET",
  "PILLOW",
  "CUSHION",
  "TOWEL",
  "CANVAS",
  "PHONECASE",
  "NOTEBOOK",
  "TUMBLER",
]) {
  categories[type] = "Home & living";
}
const accessoryPattern =
    /\b(?:hats?|caps?|bags?|socks?|beanies?|backpacks?|totes?|visors?)\b/iu,
  apparelPattern =
    /\b(?:t[ -]?shirts?|shirts?|hoodies?|sweatshirts?|sweatpants?|jackets?|pants|leggings?|shorts|dresses|tanks?|tees?)\b/iu;

export function merchCategory(product: { type: string | null; name: string }) {
  const category =
    categories[product.type?.toUpperCase().replaceAll(/[^A-Z0-9]/gu, "") ?? ""];
  if (category) {
    return category;
  }
  if (apparelPattern.test(product.name)) {
    return "Apparel";
  }
  if (accessoryPattern.test(product.name)) {
    return "Accessories";
  }
  return "Home & living";
}
