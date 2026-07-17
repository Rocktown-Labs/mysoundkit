import { describe, expect, it } from "vitest";

import { shouldExcludeArtistSeatStream } from "./stream-qualification-rules";

describe("stream qualification seat exclusions", () => {
  it("excludes listeners who occupy an artist Premium workspace seat", () => {
    expect(
      shouldExcludeArtistSeatStream({
        artistPlanMemberUserIds: ["artist_owner", "manager", "producer"],
        listenerUserId: "producer",
      })
    ).toBe(true);
  });

  it("does not exclude unrelated listeners", () => {
    expect(
      shouldExcludeArtistSeatStream({
        artistPlanMemberUserIds: ["artist_owner", "manager", "producer"],
        listenerUserId: "fan_listener",
      })
    ).toBe(false);
  });

  it("does not exclude anonymous playback", () => {
    expect(
      shouldExcludeArtistSeatStream({
        artistPlanMemberUserIds: ["artist_owner"],
        listenerUserId: null,
      })
    ).toBe(false);
  });
});
