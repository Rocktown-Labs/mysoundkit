import { describe, expect, it } from "vitest";

import { mergePersistedGenreCatalog } from "./genre-catalog";

describe("genre catalog persistence", () => {
  it("uses the persisted id for canonical genre usage counts", () => {
    const merged = mergePersistedGenreCatalog([
      {
        description: "Rap and related styles",
        id: "persisted-hip-hop-id",
        name: "Hip-Hop/Rap",
        slug: "hip-hop",
      },
    ]);

    expect(merged.find((genre) => genre.slug === "hip-hop")).toEqual({
      description: "Rap and related styles",
      id: "persisted-hip-hop-id",
      name: "Hip Hop",
      slug: "hip-hop",
    });
  });

  it("keeps canonical fallbacks and custom persisted genres", () => {
    const merged = mergePersistedGenreCatalog([
      {
        description: null,
        id: "battle-rap-id",
        name: "Battle Rap",
        slug: "battle-rap",
      },
    ]);

    expect(merged.some((genre) => genre.slug === "hip-hop")).toBe(true);
    expect(merged).toContainEqual({
      description: null,
      id: "battle-rap-id",
      name: "Battle Rap",
      slug: "battle-rap",
    });
  });
});
