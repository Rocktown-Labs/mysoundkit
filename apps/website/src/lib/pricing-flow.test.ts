import { describe, expect, it } from "vitest";

import {
  PREMIUM_INCLUDED_SEATS,
  accountHomePathForAccount,
  premiumPlanCodeForAccount,
  premiumSuccessPathForAccount,
} from "./pricing-flow";

describe("pricing flow", () => {
  it("keeps Premium as a five-seat included plan", () => {
    expect(PREMIUM_INCLUDED_SEATS).toBe(5);
  });

  it("uses the artist premium plan for artist accounts", () => {
    expect(premiumPlanCodeForAccount("artist")).toBe("soundkit_premium_artist");
  });

  it("uses the fan premium plan for fan and unknown accounts", () => {
    expect(premiumPlanCodeForAccount("fan")).toBe("soundkit_premium_fan");
    expect(premiumPlanCodeForAccount(null)).toBe("soundkit_premium_fan");
  });

  it("routes artists to the dashboard and fans to Explore after checkout", () => {
    expect(accountHomePathForAccount("artist")).toBe("/dashboard");
    expect(accountHomePathForAccount("fan")).toBe("/");
    expect(premiumSuccessPathForAccount("artist")).toBe("/dashboard");
    expect(premiumSuccessPathForAccount("fan")).toBe("/");
  });
});
