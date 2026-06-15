/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const API_ORIGIN = "http://soundkit.test";
const AUTHENTICATION_REQUIRED = {
  message: "Authentication is required.",
};

const jsonRequest = (body: unknown, method = "POST"): RequestInit => ({
  body: JSON.stringify(body),
  headers: {
    "content-type": "application/json",
  },
  method,
});

const protectedRequests: {
  init?: RequestInit;
  label: string;
  path: string;
}[] = [
  {
    label: "current profile",
    path: "/v1/me",
  },
  {
    label: "profile entitlements",
    path: "/v1/me/entitlements",
  },
  {
    label: "cart contents",
    path: "/v1/cart",
  },
  {
    label: "subscription",
    path: "/v1/billing/subscription",
  },
  {
    label: "seller status",
    path: "/v1/seller/status",
  },
  {
    init: jsonRequest({
      assetIds: [],
      genre: "House",
      isForSale: false,
      isPublic: false,
      productionStatus: "demo",
      releaseStrategy: "private",
      title: "Authentication Test",
    }),
    label: "track creation",
    path: "/v1/tracks",
  },
  {
    init: jsonRequest({
      isPublic: false,
      projectType: "ep",
      title: "Private EP",
    }),
    label: "project creation",
    path: "/v1/projects",
  },
  {
    init: jsonRequest({
      externalPlaybackUrl: "https://media.example.test/video.mp4",
      sourceProvider: "external",
      title: "Auth Test Video",
      videoKind: "promo",
    }),
    label: "video creation",
    path: "/v1/videos",
  },
  {
    init: jsonRequest({
      format: "best_of_3",
      genre: "House",
      opponentUsername: "rival",
    }),
    label: "battle challenge creation",
    path: "/v1/battles/challenge",
  },
  {
    init: jsonRequest({ trackIds: ["track_one"] }),
    label: "battle eligibility checks",
    path: "/v1/battles/eligibility",
  },
  {
    init: jsonRequest({
      cancelUrl: "https://app.example.test/cancel",
      planCode: "artist_premium",
      successUrl: "https://app.example.test/success",
    }),
    label: "checkout creation",
    path: "/v1/billing/checkout",
  },
  {
    init: jsonRequest({
      cancelUrl: "https://app.example.test/cart",
      successUrl: "https://app.example.test/library/purchased",
    }),
    label: "native product checkout",
    path: "/v1/payments/checkout",
  },
  {
    init: jsonRequest({
      amountCents: 500,
      artistUserId: "artist_1",
      cancelUrl: "https://app.example.test/artist/artist_1",
      successUrl: "https://app.example.test/artist/artist_1",
    }),
    label: "artist tips",
    path: "/v1/payments/tips",
  },
  {
    init: jsonRequest({
      cancelUrl: "https://app.example.test/communities",
      communityId: "community_1",
      successUrl: "https://app.example.test/communities",
    }),
    label: "community subscription checkout",
    path: "/v1/community-billing/checkout",
  },
  {
    init: jsonRequest({
      monthlyPriceCents: 499,
      name: "Private Studio",
    }),
    label: "community creation",
    path: "/v1/communities",
  },
  {
    init: jsonRequest({}),
    label: "seller onboarding links",
    path: "/v1/seller/account-link",
  },
  {
    init: jsonRequest({
      productType: "track",
      trackId: "track_midnight_vibes",
    }),
    label: "cart mutation",
    path: "/v1/cart/items",
  },
  {
    init: jsonRequest({ quantity: 2 }, "PATCH"),
    label: "cart item quantity update",
    path: "/v1/cart/items/cart_item_1",
  },
  {
    init: { method: "DELETE" },
    label: "cart item deletion",
    path: "/v1/cart/items/cart_item_1",
  },
  {
    init: { method: "DELETE" },
    label: "cart clearing",
    path: "/v1/cart",
  },
  {
    init: jsonRequest({ displayName: "Test Artist" }, "PATCH"),
    label: "profile update",
    path: "/v1/me/profile",
  },
  {
    init: jsonRequest({ title: "Updated Track" }, "PATCH"),
    label: "track update",
    path: "/v1/tracks/track_midnight_vibes",
  },
  {
    init: { method: "DELETE" },
    label: "track deletion",
    path: "/v1/tracks/track_midnight_vibes",
  },
  {
    init: jsonRequest(
      {
        assetKind: "master",
        objectKey: "tracks/test.wav",
      },
      "POST"
    ),
    label: "track asset creation",
    path: "/v1/tracks/track_midnight_vibes/assets",
  },
  {
    init: jsonRequest({}, "POST"),
    label: "track processing",
    path: "/v1/tracks/track_midnight_vibes/process",
  },
  {
    init: jsonRequest(
      {
        text: "Test lyric",
        timedLines: [{ endMs: 1000, startMs: 0, text: "Test lyric" }],
      },
      "POST"
    ),
    label: "lyrics submission",
    path: "/v1/tracks/track_midnight_vibes/lyrics",
  },
  {
    init: jsonRequest(
      {
        status: "approved",
      },
      "PATCH"
    ),
    label: "lyrics review",
    path: "/v1/tracks/track_midnight_vibes/lyrics/lyrics_1",
  },
  {
    init: jsonRequest({ title: "Updated Project" }, "PATCH"),
    label: "project update",
    path: "/v1/projects/project_after_dark",
  },
  {
    init: { method: "DELETE" },
    label: "project deletion",
    path: "/v1/projects/project_after_dark",
  },
];

describe("SoundKit API authentication boundaries", () => {
  it.each(protectedRequests)(
    "rejects anonymous access to $label",
    async ({ init, path }) => {
      const response = await SELF.fetch(`${API_ORIGIN}${path}`, init);
      const body = (await response.json()) as { message: string };

      expect(response.status).toBe(401);
      expect(body).toEqual(AUTHENTICATION_REQUIRED);
    }
  );

  it("does not treat arbitrary cookies as an authenticated session", async () => {
    const response = await SELF.fetch(`${API_ORIGIN}/v1/me`, {
      headers: {
        cookie: "better-auth.session_token=not-a-real-session",
      },
    });
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(401);
    expect(body).toEqual(AUTHENTICATION_REQUIRED);
  });

  it.each([
    ["private posts", "/v1/communities/community_1/posts", undefined],
    [
      "private post creation",
      "/v1/communities/community_1/posts",
      jsonRequest({ body: "Members only" }),
    ],
    ["private chat", "/v1/communities/community_1/messages", undefined],
    [
      "private chat creation",
      "/v1/communities/community_1/messages",
      jsonRequest({ body: "Members only" }),
    ],
    ["private member list", "/v1/communities/community_1/members", undefined],
  ])("rejects anonymous access to %s", async (_label, path, init) => {
    const response = await SELF.fetch(`${API_ORIGIN}${path}`, init);
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(403);
    expect(body.message).toContain("active community membership");
  });

  it("keeps finance administration restricted", async () => {
    const response = await SELF.fetch(`${API_ORIGIN}/v1/admin/finance/summary`);

    expect(response.status).toBe(403);
  });
});
