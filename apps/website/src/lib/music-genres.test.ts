import { describe, expect, it } from "vitest";

import { canonicalGenreName, genreLabelFromValue } from "./music-genres";

describe("genre display labels", () => {
  it("renders hip-hop aliases with the canonical title-case label", () => {
    expect(genreLabelFromValue("hip-hop")).toBe("Hip-Hop");
    expect(genreLabelFromValue("Hip-Hop/Rap")).toBe("Hip-Hop");
    expect(canonicalGenreName("hip-hop")).toBe("Hip-Hop");
  });

  it("keeps other canonical genre labels readable", () => {
    expect(genreLabelFromValue("rb-soul")).toBe("R&B/Soul");
    expect(canonicalGenreName(null)).toBe("Hip-Hop");
  });
});
