import { describe, expect, it } from "vitest";

import { hasCommunityAccess } from "./community-access-policy";

const noSubscriptions: [] = [];

describe("community access policy", () => {
  it("allows owners and explicit members", () => {
    expect(
      hasCommunityAccess({
        isBanned: false,
        isMember: false,
        isOwner: true,
        subscriptions: noSubscriptions,
      })
    ).toBe(true);
    expect(
      hasCommunityAccess({
        isBanned: false,
        isMember: true,
        isOwner: false,
        subscriptions: noSubscriptions,
      })
    ).toBe(true);
  });

  it("allows active paid subscriptions", () => {
    expect(
      hasCommunityAccess({
        isBanned: false,
        isMember: false,
        isOwner: false,
        subscriptions: [{ currentPeriodEnd: null, status: "active" }],
      })
    ).toBe(true);
  });

  it("denies users without membership", () => {
    expect(
      hasCommunityAccess({
        isBanned: false,
        isMember: false,
        isOwner: false,
        subscriptions: noSubscriptions,
      })
    ).toBe(false);
  });

  it("makes bans override every access source", () => {
    expect(
      hasCommunityAccess({
        isBanned: true,
        isMember: true,
        isOwner: true,
        subscriptions: [{ currentPeriodEnd: null, status: "active" }],
      })
    ).toBe(false);
  });
});
