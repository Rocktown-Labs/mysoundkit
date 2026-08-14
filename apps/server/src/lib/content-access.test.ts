import { describe, expect, it } from "vitest";

import {
  isExclusivityActive,
  resolveDownloadAccess,
  resolveListeningAccess,
} from "@/lib/content-access";

const protectedPolicy = {
  exclusiveUntil: "2026-04-01T00:00:00.000Z",
  isForSale: true,
  listeningAccess: "premium_or_purchased" as const,
};

describe("resolveListeningAccess", () => {
  it("allows free content to everyone", () => {
    expect(
      resolveListeningAccess({
        hasPurchase: false,
        isPremium: false,
        policy: { ...protectedPolicy, isForSale: false },
      })
    ).toEqual({ canListen: true, isPreview: false, reason: "free" });
  });

  it("allows premium users and purchasers during exclusivity", () => {
    const now = new Date("2026-03-01T00:00:00.000Z");

    expect(
      resolveListeningAccess({
        hasPurchase: false,
        isPremium: true,
        now,
        policy: protectedPolicy,
      }).canListen
    ).toBe(true);
    expect(
      resolveListeningAccess({
        hasPurchase: true,
        isPremium: false,
        now,
        policy: protectedPolicy,
      }).reason
    ).toBe("purchased");
  });

  it("returns a preview decision for ineligible listeners", () => {
    expect(
      resolveListeningAccess({
        hasPurchase: false,
        isPremium: false,
        now: new Date("2026-03-01T00:00:00.000Z"),
        policy: protectedPolicy,
      })
    ).toEqual({ canListen: false, isPreview: true, reason: "preview" });
  });

  it("makes protected content public after exclusivity expires", () => {
    expect(
      resolveListeningAccess({
        hasPurchase: false,
        isPremium: false,
        now: new Date("2026-04-02T00:00:00.000Z"),
        policy: protectedPolicy,
      })
    ).toEqual({ canListen: true, isPreview: false, reason: "public" });
  });
});

describe("resolveDownloadAccess", () => {
  const freePolicy = {
    downloadsAllowed: true,
    downloadsRequireFirstPlay: true,
    downloadsRequirePurchase: false,
    isForSale: false,
  };

  it("allows free downloads after the first play", () => {
    expect(
      resolveDownloadAccess({
        hasPlayed: true,
        hasPurchase: false,
        isPremium: false,
        policy: freePolicy,
      })
    ).toEqual({ allowed: true, reason: "free" });
  });

  it("requires first play for free downloads", () => {
    expect(
      resolveDownloadAccess({
        hasPlayed: false,
        hasPurchase: false,
        isPremium: false,
        policy: freePolicy,
      })
    ).toEqual({ allowed: false, reason: "first_play_required" });
  });

  it("requires purchase for monetized downloads", () => {
    expect(
      resolveDownloadAccess({
        hasPlayed: true,
        hasPurchase: false,
        isPremium: false,
        policy: {
          ...freePolicy,
          downloadsRequirePurchase: true,
          isForSale: true,
        },
      })
    ).toEqual({ allowed: false, reason: "purchase_required" });
  });
});

describe("isExclusivityActive", () => {
  it("rejects invalid dates", () => {
    expect(isExclusivityActive("not-a-date")).toBe(false);
  });
});
