/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { describe, expect, it } from "vitest";

import { describeBattleTiming } from "./ad-serving";

const at = (iso: string) => new Date(iso);

describe("describeBattleTiming", () => {
  it("labels live and finished battles", () => {
    expect(
      describeBattleTiming({
        now: at("2026-09-04T18:00:00Z"),
        startsAt: null,
        status: "live",
      })
    ).toBe("Live now");
    expect(
      describeBattleTiming({
        now: at("2026-09-04T18:00:00Z"),
        startsAt: null,
        status: "completed",
      })
    ).toBe("Recently battled");
    expect(
      describeBattleTiming({
        now: at("2026-09-04T18:00:00Z"),
        startsAt: null,
        status: "scheduled",
      })
    ).toBe("Coming soon");
  });

  it("labels same-day battles as tonight in ET", () => {
    // 2026-09-04 18:00Z = 14:00 ET; 9PM ET = 01:00Z next day.
    expect(
      describeBattleTiming({
        now: at("2026-09-04T18:00:00Z"),
        startsAt: at("2026-09-05T01:00:00Z"),
        status: "scheduled",
      })
    ).toBe("Tonight 9:00 PM ET");
  });

  it("labels next-day battles as tomorrow", () => {
    expect(
      describeBattleTiming({
        now: at("2026-09-04T18:00:00Z"),
        startsAt: at("2026-09-06T00:00:00Z"),
        status: "scheduled",
      })
    ).toBe("Tomorrow 8:00 PM ET");
  });

  it("labels battles later in the week by weekday", () => {
    const label = describeBattleTiming({
      now: at("2026-09-04T18:00:00Z"),
      startsAt: at("2026-09-08T00:00:00Z"),
      status: "scheduled",
    });
    expect(label).toContain("Monday");
    expect(label).toContain("ET");
  });

  it("labels started-but-not-live battles as starting soon", () => {
    expect(
      describeBattleTiming({
        now: at("2026-09-05T02:00:00Z"),
        startsAt: at("2026-09-05T01:00:00Z"),
        status: "scheduled",
      })
    ).toBe("Starting soon");
  });
});
