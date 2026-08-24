/* eslint-disable one-var, sort-vars */
import { describe, expect, it } from "vitest";

import { mapScopes } from "./map-scopes";

describe("Map Navigation Scopes", () => {
  it("includes global and continent region options", () => {
    const scopeIds = mapScopes.map((s) => s.id);
    expect(scopeIds).toContain("global");
    expect(scopeIds).toContain("north-america");
    expect(scopeIds).toContain("africa");
    expect(scopeIds).toContain("europe");
    expect(scopeIds).toContain("asia");
    expect(scopeIds).toContain("latin-america");
    expect(scopeIds).toContain("oceania");
  });

  it("assigns appropriate projections and scale parameters", () => {
    const globalScope = mapScopes.find((s) => s.id === "global"),
      africaScope = mapScopes.find((s) => s.id === "africa");
    expect(globalScope?.projection).toBe("geoEqualEarth");
    expect(globalScope?.scale).toBe(180);
    expect(africaScope?.projection).toBe("geoMercator");
    expect(africaScope?.scale).toBeGreaterThan(100);
  });
});
