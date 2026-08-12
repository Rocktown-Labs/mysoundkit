import { describe, expect, it } from "vitest";

import { isExclusivityActive } from "@/lib/content-access";

describe("scheduled release rules", () => {
  it("recognizes a release date in the past as due", () => {
    expect(
      isExclusivityActive("2026-03-01T00:00:00.000Z", new Date("2026-03-02"))
    ).toBe(false);
  });
});
