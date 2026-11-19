const accessoryPattern =
    /\b(?:hats?|caps?|bags?|socks?|beanies?|backpacks?|totes?|visors?)\b/iu,
  apparelPattern =
    /\b(?:t[ -]?shirts?|shirts?|hood(?:ie)?s?|sweat\w*|jackets?|pants|leggings?|shorts|dresses|tanks?|tees?)\b/iu;

export function merchCategory(product: { type: string | null; name: string }) {
  for (const text of [product.type ?? "", product.name]) {
    if (apparelPattern.test(text)) {return "Apparel";}
    if (accessoryPattern.test(text)) {return "Accessories";}
  }
  return "Home & living";
}
