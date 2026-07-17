import { describe, expect, it } from "vitest";

import {
  accountHomePathForAccount,
  premiumPlanCodeForAccount,
  premiumSuccessPathForAccount,
} from "./pricing-flow";

describe("pricing flow", () => {
  it("uses the artist premium plan for artist accounts", () => {
    expect(premiumPlanCodeForAccount("artist")).toBe("soundkit_premium_artist");
  });

  it("uses the fan premium plan for fan and unknown accounts", () => {
    expect(premiumPlanCodeForAccount("fan")).toBe("soundkit_premium_fan");
    expect(premiumPlanCodeForAccount(null)).toBe("soundkit_premium_fan");
  });

  it("routes artists to dashboard and fans to library after signup or checkout", () => {
    expect(accountHomePathForAccount("artist")).toBe("/dashboard");
    expect(accountHomePathForAccount("fan")).toBe("/library/settings");
    expect(premiumSuccessPathForAccount("fan")).toBe("/library/settings");
  });
});
