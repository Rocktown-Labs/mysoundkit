/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { describe, expect, it } from "vitest";

import { cosineSimilarity, fuseRankings } from "./audio-embeddings";

describe("cosineSimilarity", () => {
  it("scores identical vectors at 1 and opposites at -1", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
    expect(cosineSimilarity([1, 1], [1, 0])).toBeCloseTo(Math.SQRT1_2);
  });
  it("returns 0 for zero vectors", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

describe("fuseRankings", () => {
  it("blends text and audio over the union of ids", () => {
    const fused = fuseRankings({
      audio: [
        { id: "a", similarity: 1 },
        { id: "c", similarity: 0 },
      ],
      audioWeight: 0.5,
      text: [
        { id: "a", score: 0.5 },
        { id: "b", score: 0.9 },
      ],
    });
    expect(fused.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    expect(fused[0]?.fusedScore).toBeCloseTo(0.75);
  });
  it("weight 0 ignores audio entirely", () => {
    const fused = fuseRankings({
      audio: [{ id: "a", similarity: 1 }],
      audioWeight: 0,
      text: [{ id: "a", score: 0.4 }],
    });
    expect(fused[0]?.fusedScore).toBeCloseTo(0.4);
  });
});
