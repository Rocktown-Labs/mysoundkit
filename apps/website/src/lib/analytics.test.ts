/* eslint-disable one-var */
import { afterEach, expect, test, vi } from "vitest";

import { capture } from "./analytics";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.doUnmock("posthog-js");
});

test("one failing queued diagnostic does not discard later operations", async () => {
  const sdkCapture = vi.fn().mockImplementationOnce(() => {
    throw new Error("invalid diagnostic operation");
  });
  vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "fixture-token");
  vi.doMock("posthog-js", () => ({
    default: { capture: sdkCapture, init: vi.fn() },
  }));
  vi.stubGlobal("window", {
    // eslint-disable-next-line promise/prefer-await-to-callbacks -- browser scheduling fixture
    requestIdleCallback: (callback: () => void) => callback(),
  });
  vi.resetModules();
  const analytics = await import("./analytics");
  analytics.capture("track_play_started");
  analytics.capture("track_saved");
  analytics.loadAnalytics();
  await vi.waitFor(() => expect(sdkCapture).toHaveBeenCalledTimes(2));
  expect(sdkCapture.mock.lastCall?.[0]).toBe("track_saved");
});

test("capture is safe without a browser or tracker", () => {
  expect(() => capture("onboarding_started")).not.toThrow();
  vi.stubGlobal("window", {});
  expect(() => capture("onboarding_started")).not.toThrow();
});

test("Traks receives flat finite properties and a separate monetary value", () => {
  const traks = vi.fn();
  vi.stubGlobal("window", { traks });
  capture("checkout_completed", {
    amount: 12,
    artist_name: "Private name",
    details: { private: true },
    invalid: Number.NaN,
    kind: "track",
    missing: null,
    optional: undefined,
    paid: true,
    tags: ["track"],
    type: "track",
    user_id: "private-id",
    value: 19.99,
  });
  expect(traks).toHaveBeenCalledExactlyOnceWith(
    "checkout_completed",
    { kind: "track" },
    19.99
  );
});

test("an explicit zero value is preserved and non-finite values are omitted", () => {
  const traks = vi.fn();
  vi.stubGlobal("window", { traks });
  capture("checkout_completed", undefined, 0);
  expect(traks).toHaveBeenLastCalledWith("checkout_completed", {}, 0);
  capture(
    "checkout_completed",
    { invalid: Number.POSITIVE_INFINITY },
    Number.NaN
  );
  expect(traks.mock.lastCall).toEqual(["checkout_completed", {}, undefined]);
});

test("tracker exceptions cannot interrupt the measured user action", () => {
  vi.stubGlobal("window", {
    traks: () => {
      throw new Error("tracker unavailable");
    },
  });
  expect(() => capture("track_play_started")).not.toThrow();
});
