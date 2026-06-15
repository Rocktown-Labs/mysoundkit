import { describe, expect, it } from "vitest";

import {
  hasCommunitySubscriptionAccess,
  resolveCommunitySubscriptionStatus,
} from "./community-subscriptions";

const NOW = new Date("2026-06-04T12:00:00.000Z");

describe("community subscription access", () => {
  it("allows active subscriptions", () => {
    expect(
      hasCommunitySubscriptionAccess({
        currentPeriodEnd: null,
        now: NOW,
        status: "active",
      })
    ).toBe(true);
  });

  it("keeps canceled members through the paid period", () => {
    expect(
      hasCommunitySubscriptionAccess({
        currentPeriodEnd: new Date("2026-06-05T12:00:00.000Z"),
        now: NOW,
        status: "canceled",
      })
    ).toBe(true);
  });

  it.each(["past_due", "expired", "pending"] as const)(
    "denies %s subscriptions",
    (status) => {
      expect(
        hasCommunitySubscriptionAccess({
          currentPeriodEnd: new Date("2026-06-05T12:00:00.000Z"),
          now: NOW,
          status,
        })
      ).toBe(false);
    }
  );

  it("denies canceled subscriptions after the paid period", () => {
    expect(
      hasCommunitySubscriptionAccess({
        currentPeriodEnd: new Date("2026-06-03T12:00:00.000Z"),
        now: NOW,
        status: "canceled",
      })
    ).toBe(false);
  });
});

describe("community Stripe status mapping", () => {
  it("maps active and failed Stripe statuses", () => {
    expect(
      resolveCommunitySubscriptionStatus({
        eventType: "customer.subscription.updated",
        now: NOW,
        stripeStatus: "trialing",
      })
    ).toBe("active");
    expect(
      resolveCommunitySubscriptionStatus({
        eventType: "customer.subscription.updated",
        now: NOW,
        stripeStatus: "past_due",
      })
    ).toBe("past_due");
  });

  it("keeps deleted subscriptions canceled until their paid period ends", () => {
    expect(
      resolveCommunitySubscriptionStatus({
        currentPeriodEndSeconds:
          new Date("2026-06-05T12:00:00.000Z").getTime() / 1000,
        eventType: "customer.subscription.deleted",
        now: NOW,
      })
    ).toBe("canceled");
    expect(
      resolveCommunitySubscriptionStatus({
        currentPeriodEndSeconds:
          new Date("2026-06-03T12:00:00.000Z").getTime() / 1000,
        eventType: "customer.subscription.deleted",
        now: NOW,
      })
    ).toBe("expired");
  });
});
