/* eslint-disable one-var, sort-vars */
import { describe, expect, it, vi } from "vitest";

import { createTraksClient, traksCollectorUrl } from "./browser";
import { analyticsRoute, sanitizeAnalyticsProperties } from "./contracts";

const secret = "private-person@example.test",
  makeClient = (surface: "bio" | "web" = "bio", hostname = "soundkit.bio") => {
    const transport = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(null, { status: 204 }))
      ),
      client = createTraksClient({
        hostname,

        surface,
        transport,
      });
    return { client, transport };
  };

describe("anonymous analytics privacy contract", () => {
  it("measures media transitions using the observed provider, without inventing dimensions", () => {
    const { client, transport } = makeClient();
    client.capture("track_play_started", { source: "bio" });
    client.capture("video_play_started", {
      provider: "youtube",
      user_id: "private",
    });
    client.capture("video_play_started", { provider: "youtube" });
    const transitions = transport.mock.calls
      .map((call) => JSON.parse(String(call[1]?.body)))
      .filter((event) => event.en === "media_transition_completed");
    expect(transitions).toHaveLength(1);
    expect(JSON.parse(transitions[0].ep)).toEqual({
      media_type: "video",
      provider: "youtube",
      surface: "bio",
    });
    expect(analyticsRoute("/artists", "web")).toBe("/artists");
    expect(analyticsRoute("/artists/missing", "web")).toBe("/other");
  });
  it("retains bounded legacy dimensions without retaining private identifiers", () => {
    expect(
      sanitizeAnalyticsProperties("account_created", {
        account_type: "artist",
        auth_method: "google",
        user_id: "private",
      })
    ).toEqual({ account_type: "artist", method: "google" });
    expect(
      sanitizeAnalyticsProperties("region_selected", {
        region: "private",
        region_type: "global",
        scope: "europe",
      })
    ).toEqual({ region_type: "global", scope: "europe" });
    expect(
      sanitizeAnalyticsProperties("track_play_started", {
        source: "listening_party",
      })
    ).toEqual({ source: "listening_party" });
    expect(
      sanitizeAnalyticsProperties("onboarding_completed", {
        selected_plan: "soundkit_premium_artist",
      })
    ).toEqual({ selected_plan: "soundkit_premium_artist" });
    expect(analyticsRoute("/library", "bio")).toBe("/library");
    expect(
      sanitizeAnalyticsProperties("cart_item_added", {
        media_format: "vinyl_12",
        product_type: "physical_merch",
        purchase_mode: "physical_merch",
        title: "private",
      })
    ).toEqual({
      media_format: "vinyl_12",
      product_type: "physical_merch",
      purchase_mode: "physical_merch",
    });
  });
  it("preserves the existing numeric onboarding steps as bounded step numbers", () => {
    expect(
      sanitizeAnalyticsProperties("onboarding_step_viewed", {
        account_type: "artist",
        step: 3,
      })
    ).toEqual({ account_type: "artist", step_number: 3 });
    expect(
      sanitizeAnalyticsProperties("onboarding_step_viewed", { step: 99 })
    ).toEqual({});
    expect(
      sanitizeAnalyticsProperties("creator_eligibility_declared", {
        eligibility: "independent",
      })
    ).toEqual({ eligibility: "independent" });
  });
  it("normalizes adversarial slash sequences without a backtracking pattern", () => {
    expect(analyticsRoute(`${"/".repeat(100_000)}x`, "web")).toBe("/other");
    expect(analyticsRoute(`/login${"/".repeat(100_000)}`, "web")).toBe(
      "/login"
    );
    expect(analyticsRoute("///", "web")).toBe("/");
  });
  it.each([
    ["bio", `/${secret}?token=secret`, "/artist"],
    ["web", `/artist/${secret}`, "/artist/:artist"],
    ["web", `/dashboard/tracks/${secret}/edit`, "/dashboard/tracks/:track"],
    ["web", `/messages/${secret}`, "/other"],
    ["web", "/reset-password?token=secret", "/reset-password"],
  ] as const)(
    "templates %s paths before collection",
    (surface, path, expected) => {
      expect(analyticsRoute(path, surface)).toBe(expected);
    }
  );

  it("sends only schema-approved values, with no URL, referrer, or credentials", () => {
    const { client, transport } = makeClient();
    client.pageview(`/${secret}`);
    client.capture("track_play_started", {
      artist_name: secret,
      source: "bio",
      track_id: secret,
      url: `https://example.test/${secret}`,
    });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1]?.[0]).toBe(traksCollectorUrl);
    expect(transport.mock.calls[1]?.[1]).toMatchObject({
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    expect(JSON.stringify(transport.mock.calls)).not.toContain(secret);
    expect(
      JSON.parse(String(transport.mock.calls[1]?.[1]?.body))
    ).toMatchObject({
      en: "track_play_started",
      ep: JSON.stringify({ source: "bio", surface: "bio" }),
      p: "/artist",
      s: "pb_live_bi7j9kw1gfy9ob8x690iw79d",
      sid: expect.any(String),
    });
  });

  it("does not treat arbitrary strings or nested objects as safe dimensions", () => {
    expect(
      sanitizeAnalyticsProperties("cart_item_added", {
        artist_name: "An artist",
        product_type: secret,
        purchase_mode: { name: secret },
        quantity: Number.POSITIVE_INFINITY,
        title: "Private title",
      })
    ).toEqual({});
    expect(
      sanitizeAnalyticsProperties("cart_item_added", {
        product_type: "track",
        quantity: 2,
      })
    ).toEqual({ product_type: "track", quantity: 2 });
  });

  it("drops unknown event names rather than sending dynamic names containing PII", () => {
    const { client, transport } = makeClient();
    client.capture(`played_${secret}`);
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    "localhost",
    "soundkit-web-pr-496.mysoundkit.com",
    "soundkit.bio.attacker.test",
  ])("excludes nonproduction host %s", (hostname) => {
    const { client, transport } = makeClient("bio", hostname);
    client.pageview("/");
    client.capture("track_play_started");
    expect(transport).not.toHaveBeenCalled();
  });

  it("counts different profiles while deduplicating repeated notifications of the same route", () => {
    const { client, transport } = makeClient();
    client.pageview("/first-person");
    client.pageview("/first-person");
    client.pageview("/second-person");
    expect(transport).toHaveBeenCalledTimes(2);
    expect(
      transport.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).p)
    ).toEqual(["/artist", "/artist"]);
  });

  it("attributes visible time to the page that was actually visible", () => {
    const transport = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 204 }))
    );
    let clock = 0;
    const client = createTraksClient({
      hostname: "soundkit.bio",
      now: () => clock,

      surface: "bio",
      transport,
    });
    client.setVisible(true);
    client.pageview("/");
    clock = 5000;
    client.pageview("/person");
    clock = 8000;
    client.setVisible(false);
    clock = 100_000;
    client.setVisible(false);
    expect(
      transport.mock.calls
        .map((call) => JSON.parse(String(call[1]?.body)))
        .filter((event) => event.t === "engagement")
    ).toEqual([
      expect.objectContaining({ ev: 5, p: "/" }),
      expect.objectContaining({ ev: 3, p: "/artist" }),
    ]);
  });

  it("synchronizes the route before a child component records a conversion", () => {
    const transport = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(null, { status: 204 }))
      ),
      client = createTraksClient({
        getPathname: () => "/signup/artist/onboarding",
        hostname: "mysoundkit.com",

        surface: "web",
        transport,
      });
    client.capture("onboarding_started", { account_type: "artist" });
    expect(
      transport.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).t)
    ).toEqual(["pageview", "event"]);
    expect(
      transport.mock.calls.every(
        (call) =>
          JSON.parse(String(call[1]?.body)).p === "/signup/artist/onboarding"
      )
    ).toBe(true);
  });

  it("isolates network failures from the product action", async () => {
    const client = createTraksClient({
      hostname: "mysoundkit.com",

      surface: "web",
      transport: vi.fn(() => Promise.reject(new Error("offline"))),
    });
    expect(() => client.capture("account_created")).not.toThrow();
    await Promise.resolve();
  });
});
