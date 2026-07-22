import { describe, expect, it } from "vitest";
import { mapScopes } from "../components/explore/world-and-usa-map";

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

  it("assigns appropriate projections and zoom parameters", () => {
    const globalScope = mapScopes.find((s) => s.id === "global");
    expect(globalScope?.projection).toBe("geoEqualEarth");
    expect(globalScope?.zoom).toBe(1);

    const africaScope = mapScopes.find((s) => s.id === "africa");
    expect(africaScope?.projection).toBe("geoMercator");
    expect(africaScope?.zoom).toBeGreaterThan(1);
  });
});
