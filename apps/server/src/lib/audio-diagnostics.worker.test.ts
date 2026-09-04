/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { describe, expect, it } from "vitest";

import {
  evaluateDerivativeLoudness,
  evaluateGainEstimate,
  evaluateMasterHeadroom,
  evaluatePlaybackResolution,
} from "./audio-diagnostics";
import { MEDIA_PIPELINE_VERSION } from "./media-pipeline";

describe("audio diagnostic evaluators", () => {
  it("passes derivatives inside the LUFS and true-peak gates", () => {
    expect(
      evaluateDerivativeLoudness({ integratedLufs: -13.2, truePeakDbtp: -1.4 })
    ).toMatchObject({ test: "derivative_loudness", verdict: "pass" });
  });

  it("fails derivatives with inter-sample peaks above 0 dBFS", () => {
    const check = evaluateDerivativeLoudness({
      integratedLufs: -13.1,
      truePeakDbtp: 0.3,
    });
    expect(check.verdict).toBe("fail");
    expect(check.detail).toContain("0 dBFS");
  });

  it("warns on loudness misses and ceiling breaches below 0 dBFS", () => {
    expect(
      evaluateDerivativeLoudness({ integratedLufs: -10.5, truePeakDbtp: -1.2 })
        .verdict
    ).toBe("warn");
    expect(
      evaluateDerivativeLoudness({ integratedLufs: -13, truePeakDbtp: -0.4 })
        .verdict
    ).toBe("warn");
  });

  it("skips loudness evaluation without measurements", () => {
    expect(
      evaluateDerivativeLoudness({ integratedLufs: null, truePeakDbtp: null })
        .verdict
    ).toBe("skipped");
  });

  it("warns on large upward normalization gain", () => {
    const check = evaluateGainEstimate({
      derivativeLufs: -13,
      masterLufs: -22,
    });
    expect(check.verdict).toBe("warn");
    expect(check.detail).toContain("+9.0 dB");
  });

  it("passes modest gain changes", () => {
    expect(
      evaluateGainEstimate({ derivativeLufs: -13, masterLufs: -16 }).verdict
    ).toBe("pass");
  });

  it("flags masters that already clip at upload", () => {
    const check = evaluateMasterHeadroom(0.7);
    expect(check.verdict).toBe("warn");
    expect(check.detail).toContain("baked into the upload");
  });

  it("passes clean masters and skips missing measurements", () => {
    expect(evaluateMasterHeadroom(-2.1).verdict).toBe("pass");
    expect(evaluateMasterHeadroom(null).verdict).toBe("skipped");
  });

  it("passes current normalized derivatives and warns on stale versions", () => {
    expect(
      evaluatePlaybackResolution({
        assetKind: "master",
        assetPurpose: "streaming",
        processingVersion: MEDIA_PIPELINE_VERSION,
      }).verdict
    ).toBe("pass");
    const stale = evaluatePlaybackResolution({
      assetKind: "master",
      assetPurpose: "streaming",
      processingVersion: MEDIA_PIPELINE_VERSION - 3,
    });
    expect(stale.verdict).toBe("warn");
    expect(stale.detail).toContain("backfill");
  });

  it("warns when playback bypasses normalization", () => {
    const check = evaluatePlaybackResolution({
      assetKind: "untagged_wav",
      assetPurpose: "master",
      processingVersion: null,
    });
    expect(check.verdict).toBe("warn");
    expect(check.detail).toContain("bypasses normalization");
  });

  it("fails tracks with no playable asset", () => {
    expect(
      evaluatePlaybackResolution({
        assetKind: null,
        assetPurpose: null,
        processingVersion: null,
      }).verdict
    ).toBe("fail");
  });
});
