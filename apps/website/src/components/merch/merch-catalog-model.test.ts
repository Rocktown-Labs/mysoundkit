import { describe, expect, it } from "vitest";

import { merchCategory } from "./merch-catalog-model";

describe("merch categories", () => {
  it.each([
    ["Stainless Steel Bottle", "BOTTLE", "Home & living"],
    ["Ceramic mug", null, "Home & living"],
    ["Classic tee", "T-SHIRT", "Apparel"],
    ["Bucket hat", "HAT", "Accessories"],
    ["Shoulder bag", null, "Accessories"],
  ])("classifies %s without substring collisions", (name, type, category) => {
    expect(merchCategory({ name, type })).toBe(category);
  });
});
