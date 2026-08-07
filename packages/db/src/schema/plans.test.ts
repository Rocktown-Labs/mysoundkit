import { describe, expect, it } from "vitest";

import { aiCreditGrants, subscriptionEntitlements } from "./plans";

describe("plan and entitlement schema", () => {
  it("persists AI credit grants as an auditable ledger", () => {
    expect(aiCreditGrants.amount.notNull).toBe(true);
    expect(aiCreditGrants.userId.notNull).toBe(true);
    expect(aiCreditGrants.source.default).toBe("admin_grant");
  });

  it("stores explicit entitlement overrides for granted subscriptions", () => {
    expect(subscriptionEntitlements.entitlementKey.notNull).toBe(true);
    expect(subscriptionEntitlements.entitlementValue.notNull).toBe(true);
  });
});
