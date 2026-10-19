import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadRegionSelection, saveRegionSelection } from "./region-store";

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: (key: string) => Promise.resolve(storage.get(key) ?? null),
    removeItem: (key: string) => {
      storage.delete(key);
      return Promise.resolve();
    },
    setItem: (key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    },
  },
}));

describe("region-store", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("returns null when nothing has been persisted", async () => {
    await expect(loadRegionSelection()).resolves.toBeNull();
  });

  it("round-trips a scope with a picked region", async () => {
    await saveRegionSelection({ mapScope: "europe", regionName: "France" });
    await expect(loadRegionSelection()).resolves.toEqual({
      mapScope: "europe",
      regionName: "France",
    });
  });

  it("round-trips a scope without a picked region", async () => {
    await saveRegionSelection({ mapScope: "usa", regionName: null });
    await expect(loadRegionSelection()).resolves.toEqual({
      mapScope: "usa",
      regionName: null,
    });
  });

  it("clears the region name when a new scope selection has none", async () => {
    await saveRegionSelection({ mapScope: "europe", regionName: "France" });
    await saveRegionSelection({ mapScope: "global", regionName: null });
    await expect(loadRegionSelection()).resolves.toEqual({
      mapScope: "global",
      regionName: null,
    });
  });

  it("rejects corrupt persisted scopes", async () => {
    storage.set("@soundkit/explore_map_scope", "bogus");
    storage.set("@soundkit/explore_region_name", "France");
    await expect(loadRegionSelection()).resolves.toBeNull();
  });

  it("ignores blank region names", async () => {
    await saveRegionSelection({ mapScope: "asia", regionName: "   " });
    await expect(loadRegionSelection()).resolves.toEqual({
      mapScope: "asia",
      regionName: null,
    });
  });
});
