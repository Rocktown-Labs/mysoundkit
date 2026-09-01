import { describe, expect, it } from "vitest";

import { buildTipAllocations } from "./tips";

describe("tip allocations", () => {
  it("splits a battle tip equally between both artists", () => {
    expect(
      buildTipAllocations({
        amountCents: 2000,
        artistAmountCents: 1900,
        recipientUserIds: ["artist-a", "artist-b"],
      })
    ).toEqual([
      {
        amountCents: 1000,
        artistAmountCents: 950,
        artistUserId: "artist-a",
      },
      {
        amountCents: 1000,
        artistAmountCents: 950,
        artistUserId: "artist-b",
      },
    ]);
  });

  it("assigns the remainder cents to the first recipient", () => {
    expect(
      buildTipAllocations({
        amountCents: 101,
        artistAmountCents: 95,
        recipientUserIds: ["artist-a", "artist-b"],
      })
    ).toEqual([
      { amountCents: 51, artistAmountCents: 48, artistUserId: "artist-a" },
      { amountCents: 50, artistAmountCents: 47, artistUserId: "artist-b" },
    ]);
  });

  it("rejects invalid allocation inputs", () => {
    expect(() =>
      buildTipAllocations({
        amountCents: 0,
        artistAmountCents: 0,
        recipientUserIds: ["artist-a"],
      })
    ).toThrow("Tip amount must be a positive integer.");
    expect(() =>
      buildTipAllocations({
        amountCents: 100,
        artistAmountCents: 95,
        recipientUserIds: ["artist-a", "artist-a"],
      })
    ).toThrow("A tip must have one or two unique recipients.");
  });
});
