import { describe, expect, it } from "vitest";

import {
  PREMIUM_INCLUDED_SEATS,
  accountHomePathForAccount,
  premiumPlanCodeForAccount,
  premiumSuccessPathForAccount,
} from "./pricing-flow";

describe("pricing flow", () => {
  it("keeps Premium as a three-seat included plan", () => {
    expect(PREMIUM_INCLUDED_SEATS).toBe(3);
  });

  it("uses the artist premium plan for artist accounts", () => {
    expect(premiumPlanCodeForAccount("artist")).toBe("soundkit_premium_artist");
  });

  it("uses the fan premium plan for fan and unknown accounts", () => {
    expect(premiumPlanCodeForAccount("fan")).toBe("soundkit_premium_fan");
    expect(premiumPlanCodeForAccount(null)).toBe("soundkit_premium_fan");
  });

  it("routes artists to payments setup and fans to Explore after checkout", () => {
    expect(accountHomePathForAccount("artist")).toBe("/dashboard");
    expect(accountHomePathForAccount("fan")).toBe("/");
    expect(premiumSuccessPathForAccount("artist")).toBe(
      "/dashboard/career/payments"
    );
    expect(premiumSuccessPathForAccount("fan")).toBe("/");
  });
});
