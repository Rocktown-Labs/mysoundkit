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
      planCode: "artist_lite_ads",
      successUrl: "https://app.example.test/success",
    }),
    label: "checkout creation",
    path: "/v1/billing/checkout",
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
});
