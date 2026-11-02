import { afterEach, expect, test, vi } from "vitest";

import { capture } from "./analytics";

afterEach(() => {
  vi.unstubAllGlobals();
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
