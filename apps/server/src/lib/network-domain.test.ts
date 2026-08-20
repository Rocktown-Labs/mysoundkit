import { describe, expect, it } from "vitest";

import { mergeNetworkPerson, sortNetworkPeople } from "./network-domain";

describe("network relationship boundaries", () => {
  const person = (id: string, accountType: "artist" | "fan") => ({
    accountType,
    avatarUrl: null,
    canMessage: false,
    email: `${id}@soundkit.test`,
    followsYou: false,
    id,
    isFollowing: false,
    isFriend: false,
    name: id,
    username: id,
  });

  it("keeps follow, friendship, and messageability as independent flags", () => {
    const people = new Map();
    mergeNetworkPerson(people, person("artist-follower", "artist"), {
      followsYou: true,
    });
    mergeNetworkPerson(people, person("artist-follower", "artist"), {
      isFriend: true,
    });

    expect(people.get("artist-follower")).toMatchObject({
      canMessage: true,
      followsYou: true,
      isFollowing: false,
      isFriend: true,
    });
  });

  it("preserves fan and artist account types without inferring from profile rows", () => {
    const people = new Map();
    mergeNetworkPerson(people, person("fan", "fan"), { followsYou: true });
    mergeNetworkPerson(people, person("artist", "artist"), {
      followsYou: true,
    });

    expect(
      sortNetworkPeople(people.values()).map((entry) => entry.accountType)
    ).toEqual(["artist", "fan"]);
  });
});
