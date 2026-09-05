/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { describe, expect, it } from "vitest";

import {
  describeBattleTiming,
  buildBattlePromoCopy,
  fairnessExclusionFor,
} from "./ad-serving";

const at = (iso: string) => new Date(iso);

describe("buildBattlePromoCopy", () => {
  it("builds the uniform matchup line with genre lead and timing", () => {
    expect(
      buildBattlePromoCopy({
        artistA: "Nova Reign",
        artistB: "Kasino",
        genre: "Hip-Hop",
        status: "scheduled",
        timingLabel: "Friday 9:00 PM ET",
        title: "Summer Clash",
      })
    ).toBe(
      "If you like Hip-Hop, you'll love this matchup — Nova Reign vs Kasino. Friday 9:00 PM ET. Don't miss it."
    );
  });

  it("handles live battles and missing artists", () => {
    expect(
      buildBattlePromoCopy({
        artistA: null,
        artistB: null,
        genre: null,
        status: "live",
        timingLabel: "Live now",
        title: "Midnight Rumble",
      })
    ).toBe("Midnight Rumble. It's live right now. Get in and vote.");
  });
});

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

describe("fairnessExclusionFor", () => {
  const campaign = {
    advertiserId: "artist-b",
    allowConquest: false,
    entityGenreId: "genre-phonk",
  };
  it("excludes an artist's own promo on their content", () => {
    expect(
      fairnessExclusionFor(campaign, {
        contextGenreId: "genre-other",
        contextOwnerId: "artist-b",
      })
    ).toBe("self");
  });
  it("excludes same-genre conquest unless waived", () => {
    expect(
      fairnessExclusionFor(campaign, {
        contextGenreId: "genre-phonk",
        contextOwnerId: "artist-a",
      })
    ).toBe("conquest");
    expect(
      fairnessExclusionFor(
        { ...campaign, allowConquest: true },
        { contextGenreId: "genre-phonk", contextOwnerId: "artist-a" }
      )
    ).toBeNull();
  });
  it("allows cross-genre and ownerless contexts", () => {
    expect(
      fairnessExclusionFor(campaign, {
        contextGenreId: "genre-country",
        contextOwnerId: "artist-a",
      })
    ).toBeNull();
    expect(
      fairnessExclusionFor(campaign, {
        contextGenreId: null,
        contextOwnerId: null,
      })
    ).toBeNull();
  });
});
