import { describe, expect, it } from "vitest";

import { filterAndSortLiveItems } from "./live-collection";

const items = [
  {
    genre: "rock",
    startsAt: "2026-08-15T12:00:00.000Z",
    status: "scheduled",
    title: "Later Rock",
    viewerCount: 2,
  },
  {
    genre: "Hip-Hop",
    startsAt: "2026-08-14T12:00:00.000Z",
    status: "live",
    title: "Live Hip Hop",
    viewerCount: 12,
  },
];

describe("live collection filtering", () => {
  it("filters by genre and status", () => {
    expect(
      filterAndSortLiveItems({
        genre: "hip-hop-rap",
        items,
        sort: "starts-asc",
        status: "live",
      })
    ).toEqual([items[1]]);
  });

  it("accepts canonical API aliases when filtering by genre", () => {
    expect(
      filterAndSortLiveItems({
        genre: "hip-hop-rap",
        items,
        sort: "starts-asc",
        status: "live",
      })
    ).toEqual([items[1]]);
  });

  it("sorts by viewers", () => {
    expect(
      filterAndSortLiveItems({
        genre: "all",
        items,
        sort: "viewers-desc",
        status: "all",
      }).map((item) => item.title)
    ).toEqual(["Live Hip Hop", "Later Rock"]);
  });
});
